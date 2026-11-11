-- ABOUTME: pg_net queue interception for the isolated T-09 stack. Installed BEFORE bootstrap, seed, migrations or API
-- ABOUTME: writes. Every row offered to net.http_request_queue is DROPPED (BEFORE INSERT returns NULL) after one
-- ABOUTME: evidence row (method + destination CLASS only) is written. Fails closed when pg_net is not the queue design.
--
-- Scope, stated exactly: this intercepts the database's pg_net HTTP path (net.http_get/post/delete and anything else
-- that inserts into net.http_request_queue, e.g. supabase_functions.http_request). It is NOT a runner- or
-- container-level egress control. External notification delivery is therefore INTERCEPTED, NOT VERIFIED.
--
-- Evidence rows are transactional: a control whose transaction rolls back erases its own evidence row, so persisted
-- counts cover committed attempts only, never "every attempted request".
--
-- Runs as the stack's local `postgres` (never supabase_admin). No ownership change, no GRANT, no ALTER ROLE: when the
-- current role lacks TRIGGER on the queue, the script stops with that exact blocker instead of escalating.
--
-- LOCAL SHIM MODE: a plain PostgreSQL has no pg_net. Only when psql is run with `-v allow_shim=1` AND the database
-- carries the marker from pgnet-queue-shim.sql is the shim accepted in place of the extension, and every message says
-- LOCAL-SHIM. The CI job never passes allow_shim, so a shim on the real stack fails closed.
\set ON_ERROR_STOP 1
\if :{?allow_shim}
select set_config('t09.allow_shim', :'allow_shim', false) \gset t09_
\else
select set_config('t09.allow_shim', '0', false) \gset t09_
\endif
-- Roles whose sessions execute SQL on this stack (harness, PostgREST, GoTrue, Storage). Used only for the replica-mode
-- proof below when the guard cannot be ENABLE ALWAYS. Overridable for local controls; recorded in guard_identity.
\if :{?executing_roles}
\else
\set executing_roles 'postgres,authenticator,anon,authenticated,service_role,supabase_auth_admin,supabase_storage_admin'
\endif
select set_config('t09.executing_roles', :'executing_roles', false) \gset t09_
begin;

do $$
declare v_owner text; v_ext text; f text; v_def text; n int; v_shim boolean;
begin
  v_shim := to_regprocedure('net._t09_local_shim_marker()') is not null;
  select extversion into v_ext from pg_extension where extname = 'pg_net';
  if v_ext is null then
    if v_shim and current_setting('t09.allow_shim') = '1' then v_ext := 'LOCAL-SHIM';
    else raise exception 'egress-guard: pg_net extension is not installed (expected on supabase start)'; end if;
  elsif v_shim then
    raise exception 'egress-guard: pg_net % is installed AND the local shim marker exists; refusing a mixed design', v_ext;
  end if;
  if to_regclass('net.http_request_queue') is null then raise exception 'egress-guard: net.http_request_queue missing (pg_net %)', v_ext; end if;
  -- Every enqueueing entry point must insert into the queue. get and post are required; delete and
  -- supabase_functions.http_request are checked when present (older pg_net has no delete; webhooks are optional).
  foreach f in array array['net.http_get', 'net.http_post', 'net.http_delete', 'supabase_functions.http_request'] loop
    n := 0;
    for v_def in select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                 where ns.nspname || '.' || p.proname = f loop
      n := n + 1;
      -- The functiondef header names the function itself, so match only the BODY (after the first AS $...$).
      v_def := substring(v_def from position('AS $' in v_def));
      if (f like 'net.%' and v_def !~* 'insert\s+into\s+(net\.)?http_request_queue')
         or (f not like 'net.%' and v_def !~* '(insert\s+into\s+(net\.)?http_request_queue|net\.http_(get|post|delete)\s*\()') then
        raise exception 'egress-guard: % does not enqueue into net.http_request_queue (pg_net %); not the expected design', f, v_ext;
      end if;
    end loop;
    if n = 0 and f in ('net.http_get', 'net.http_post') then raise exception 'egress-guard: % missing (pg_net %)', f, v_ext; end if;
  end loop;
  -- Privilege first, so a role that cannot even read the queue still gets the exact blocker.
  select pg_get_userbyid(c.relowner) into v_owner from pg_class c where c.oid = 'net.http_request_queue'::regclass;
  if not has_table_privilege(current_user, 'net.http_request_queue', 'TRIGGER') then
    raise exception 'egress-guard BLOCKER: role % lacks TRIGGER on net.http_request_queue (owner %); not escalating', current_user, v_owner;
  end if;
  if not has_table_privilege(current_user, 'net.http_request_queue', 'SELECT') then
    raise exception 'egress-guard BLOCKER: role % cannot read net.http_request_queue to prove it empty (owner %); not escalating', current_user, v_owner;
  end if;
  if exists (select 1 from net.http_request_queue) then raise exception 'egress-guard: net.http_request_queue is not empty at install'; end if;
  -- Exclusivity BEFORE any bootstrap write: no other user trigger may exist on the queue (one could re-route or copy
  -- a row before ours drops it). Our own name is excluded only because a re-run drops and recreates it.
  select count(*) into n from pg_trigger
   where tgrelid = 'net.http_request_queue'::regclass and not tgisinternal and tgname <> 't09_drop_http_request';
  if n <> 0 then raise exception 'egress-guard: % other trigger(s) already on net.http_request_queue; refusing', n; end if;
  raise notice 'egress-guard: pg_net % ; queue owner % ; installing as %', v_ext, v_owner, current_user;
end $$;

create schema if not exists local_evidence;
create table if not exists local_evidence.egress_attempts (
  id bigserial primary key,
  at timestamptz not null default clock_timestamp(),
  method text,
  dest_class text not null check (dest_class in ('local-placeholder', 'other')),
  stack_label text not null default coalesce(nullif(current_setting('t09.stack_label', true), ''), 'unlabelled'),
  session_role text,   -- session_user and the SET ROLE in force when the row was offered (definer context hides it)
  set_role text
);
revoke all on schema local_evidence from public;
revoke all on all tables in schema local_evidence from public;

-- SECURITY DEFINER so the evidence row is written whatever role enqueued (authenticated through a trigger, service
-- role, postgres); pinned search_path so no caller can shadow anything it references.
create or replace function local_evidence.drop_http_request() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $fn$
begin
  insert into local_evidence.egress_attempts (method, dest_class, session_role, set_role)
  values (NEW.method::text,
          case when NEW.url = 'http://127.0.0.1:1/local-placeholder' then 'local-placeholder' else 'other' end,
          session_user::text, current_setting('role', true));
  return null;  -- drop: the row never reaches net.http_request_queue, so the worker never sees a request
end $fn$;
revoke all on function local_evidence.drop_http_request() from public;

drop trigger if exists t09_drop_http_request on net.http_request_queue;
create trigger t09_drop_http_request before insert on net.http_request_queue
  for each row execute function local_evidence.drop_http_request();

-- ENABLE ALWAYS makes the guard fire under session_replication_role = replica as well. It needs table ownership,
-- which this script never acquires. When unavailable the mode stays ORIGIN, and then the guard must PROVE that no
-- executing role can select replica mode; "not superuser" alone is not enough (a role can hold SET on the parameter,
-- inherit a superuser role, or carry an ALTER ROLE/DATABASE setting). Nothing is granted or revoked to make it pass.
do $$
begin
  execute 'alter table net.http_request_queue enable always trigger t09_drop_http_request';
exception when insufficient_privilege then
  raise notice 'egress-guard: not owner of net.http_request_queue; trigger stays ENABLE ORIGIN; proving replica mode unreachable';
end $$;

create or replace function local_evidence.replica_mode_reachable_by(p_roles text[]) returns text
language plpgsql stable set search_path = pg_catalog, pg_temp as $fn$
declare r text; v_oid oid; why text := '';
begin
  if to_regprocedure('pg_catalog.has_parameter_privilege(name, text, text)') is null then
    return 'BLOCKER: has_parameter_privilege() unavailable (PostgreSQL < 15); parameter SET grants cannot be checked';
  end if;
  foreach r in array p_roles loop
    select oid into v_oid from pg_roles where rolname = r;
    if v_oid is null then continue; end if;  -- absent roles cannot execute anything
    if exists (select 1 from pg_roles s where s.rolsuper and pg_has_role(v_oid, s.oid, 'MEMBER')) then
      why := why || format('%s can act as a superuser; ', r);
    end if;
    if has_parameter_privilege(v_oid, 'session_replication_role', 'SET') then
      why := why || format('%s holds SET on session_replication_role; ', r);
    end if;
    if exists (select 1 from pg_db_role_setting d, unnest(d.setconfig) c
               where (d.setrole = v_oid or d.setrole = 0) and c ilike 'session_replication_role=%') then
      why := why || format('%s has a stored session_replication_role setting; ', r);
    end if;
  end loop;
  return nullif(why, '');
end $fn$;
revoke all on function local_evidence.replica_mode_reachable_by(text[]) from public;

do $$
declare v_mode "char"; v_why text;
begin
  select tgenabled into v_mode from pg_trigger where tgname = 't09_drop_http_request' and tgrelid = 'net.http_request_queue'::regclass;
  if v_mode = 'O' then
    v_why := local_evidence.replica_mode_reachable_by(string_to_array(current_setting('t09.executing_roles'), ','));
    if v_why is not null then
      raise exception 'egress-guard BLOCKER: trigger is ENABLE ORIGIN (not owner) and replica mode is reachable: %not escalating', v_why;
    end if;
  end if;
end $$;

-- Fingerprint of the guard for later intactness checks (egress-verify.sql).
create table if not exists local_evidence.guard_identity (k text primary key, v text not null);
insert into local_evidence.guard_identity values
  ('function_md5', md5(pg_get_functiondef('local_evidence.drop_http_request()'::regprocedure))),
  ('trigger_def', pg_get_triggerdef((select oid from pg_trigger where tgname = 't09_drop_http_request' and tgrelid = 'net.http_request_queue'::regclass))),
  ('trigger_enabled', (select tgenabled::text from pg_trigger where tgname = 't09_drop_http_request' and tgrelid = 'net.http_request_queue'::regclass)),
  ('function_owner', (select pg_get_userbyid(proowner) from pg_proc where oid = 'local_evidence.drop_http_request()'::regprocedure)),
  ('pg_net', coalesce((select extversion from pg_extension where extname = 'pg_net'), 'LOCAL-SHIM')),
  ('pg_net_ext_oid', coalesce((select oid::text from pg_extension where extname = 'pg_net'), 'LOCAL-SHIM')),
  ('executing_roles', current_setting('t09.executing_roles')),
  ('proof_md5', md5(pg_get_functiondef('local_evidence.replica_mode_reachable_by(text[])'::regprocedure)))
on conflict (k) do update set v = excluded.v;

commit;
select 'egress-guard installed: pg_net ' || v || ', trigger mode ' ||
       (select v from local_evidence.guard_identity where k = 'trigger_enabled') as status
  from local_evidence.guard_identity where k = 'pg_net';
