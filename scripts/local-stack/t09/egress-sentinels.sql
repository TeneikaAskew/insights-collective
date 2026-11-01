-- ABOUTME: Sentinels for the egress guard, in two explicit stages. -v stage=pre runs right after the guard and BEFORE any
-- ABOUTME: bootstrap write (installed net.* only); -v stage=app runs after bootstrap and again after migrations.
--
-- What this proves, and what it does not:
--  * stage=pre (queue-only): calls through the INSTALLED public net.* entry points, as the harness role and as each API
--    role with only the privileges it already holds, each leave exactly the expected number of evidence rows while
--    net.http_request_queue stays empty. Nothing here depends on application functions, vault or cron.
--  * stage=app: everything in pre, plus the vault-reading SECURITY DEFINER callers reachable with existing grants, plus
--    two separate fanout items:
--      - INVENTORY: no trigger on ANY relation executes public.email_notification_fanout(). The frozen source inventory
--        (scripts/local-stack/t09/fanout-inventory.sh) shows the snapshot and the seven reviewed migrations attach it
--        nowhere; this catalog check fails on any unexpected reappearance.
--      - SYNTHETIC FUNCTION-UNIT coverage: the trigger function runs on a TEMPORARY scratch relation created and rolled
--        back inside this file. No public.notifications row, no auth user, no application trigger is created, restored
--        or dropped. This is NOT certificate->fanout integration and NOT external delivery.
--  * On a database carrying the local shim marker every line says LOCAL-SHIM and proves nothing about pg_net.
--  * Roles are exercised only with privileges they ALREADY hold; a denied role is recorded with an expected delta of 0.
--  * Committed steps persist their rows. The scratch step is rolled back, so its delta is measured in-transaction and
--    then erased by design: persisted counts never cover every attempted request.
--  * External notification delivery is INTERCEPTED, NOT VERIFIED.
\set ON_ERROR_STOP 1
\if :{?stage}
select set_config('t09.stage', :'stage', false) \gset t09_
\else
\echo 'egress-sentinels: -v stage=pre|app is required'
select 1/0 as stage_required;
\endif

create temporary table t09_sentinel_log (step text, detail text);

-- 1 and 2: installed net.* entry points. Both stages.
do $$
declare
  ph constant text := 'http://127.0.0.1:1/local-placeholder';
  tier constant text := case when to_regprocedure('net._t09_local_shim_marker()') is null then 'AUTHENTIC' else 'LOCAL-SHIM' end;
  before bigint; after bigint; q bigint; rid bigint; expected int; r text; denied boolean;
  count_now constant text := 'select count(*) from local_evidence.egress_attempts where dest_class = ''local-placeholder''';
begin
  if current_setting('t09.stage') not in ('pre', 'app') then
    raise exception 'egress-sentinels: stage must be pre or app (got %)', current_setting('t09.stage');
  end if;
  execute count_now into before;
  rid := net.http_post(url := ph);      if rid is not null then raise exception 'sentinel: http_post returned id % (row reached the queue?)', rid; end if;
  rid := net.http_get(url := ph);       if rid is not null then raise exception 'sentinel: http_get returned id %', rid; end if;
  expected := 2;
  if to_regprocedure('net.http_delete(text, jsonb, jsonb, integer)') is not null then
    rid := net.http_delete(url := ph);  if rid is not null then raise exception 'sentinel: http_delete returned id %', rid; end if;
    expected := 3;
  end if;
  execute count_now into after; select count(*) into q from net.http_request_queue;
  if after - before <> expected or q <> 0 then
    raise exception 'sentinel[%] entry points as %: delta % (expected %), queue %', tier, current_user, after - before, expected, q;
  end if;
  insert into t09_sentinel_log values ('entry-points', format('%s: %s delta=%s queue=0', tier, current_user, expected));

  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      insert into t09_sentinel_log values ('role-' || r, 'role absent'); continue;
    end if;
    execute count_now into before; denied := false;
    begin
      execute format('set local role %I', r);
      perform net.http_post(url := ph);
      execute 'reset role';
    exception when insufficient_privilege then
      execute 'reset role'; denied := true;
    end;
    execute count_now into after; select count(*) into q from net.http_request_queue;
    if after - before <> (case when denied then 0 else 1 end) or q <> 0 then
      raise exception 'sentinel[%] role %: delta % (expected %), queue %', tier, r, after - before, case when denied then 0 else 1 end, q;
    end if;
    insert into t09_sentinel_log values ('role-' || r,
      case when denied then 'denied by existing privilege, delta=0' else 'called net.http_post, delta=1, queue=0' end);
  end loop;
end $$;

select current_setting('t09.stage') = 'app' as t09_is_app \gset
\if :t09_is_app

-- 3. The vault-reading SECURITY DEFINER callers reachable with existing grants (service_role holds EXECUTE on both).
--    notification_email_probe is excluded on purpose: it busy-waits up to 20 s polling net._http_response.
do $$
declare before bigint; after bigint; q bigint; rid bigint;
begin
  select count(*) into before from local_evidence.egress_attempts where dest_class = 'local-placeholder';
  execute 'set local role service_role';
  rid := public.notification_digest_dispatch();
  if rid is not null then raise exception 'sentinel: notification_digest_dispatch returned request id %', rid; end if;
  rid := public.coursera_call_refresh('status');
  if rid is not null then raise exception 'sentinel: coursera_call_refresh returned request id %', rid; end if;
  execute 'reset role';
  select count(*) into after from local_evidence.egress_attempts where dest_class = 'local-placeholder';
  select count(*) into q from net.http_request_queue;
  if after - before <> 2 or q <> 0 then
    raise exception 'sentinel vault callers as service_role: delta % (expected 2), queue %', after - before, q;
  end if;
  insert into t09_sentinel_log values ('vault-callers', 'notification_digest_dispatch + coursera_call_refresh(status) as service_role: delta=2, queue=0, ids NULL');
end $$;

-- 4a. Fanout INVENTORY: no trigger on any relation may execute the function (the frozen source inventory attaches it
--     nowhere; its last application trigger was dropped by 20260816000000_notification_email_digest.sql).
do $$
declare n int; rels text;
begin
  select count(*), string_agg(format('%s.%s.%s', ns.nspname, c.relname, t.tgname), ', ') into n, rels
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace ns on ns.oid = c.relnamespace
   where t.tgfoid = 'public.email_notification_fanout()'::regprocedure;
  if n <> 0 then raise exception 'sentinel: email_notification_fanout is unexpectedly attached: %', rels; end if;
  insert into t09_sentinel_log values ('fanout-inventory', 'no trigger on any relation executes email_notification_fanout (matches the frozen source inventory)');
end $$;

-- 4b. SYNTHETIC FUNCTION-UNIT coverage on a temporary scratch relation, rolled back. The function reads only NEW.id.
begin;
create temporary table t09_scratch_fanout (id uuid primary key default gen_random_uuid());
create trigger t09_scratch_fanout_unit after insert on pg_temp.t09_scratch_fanout
  for each row execute function public.email_notification_fanout();
do $$
declare before bigint; after bigint; q bigint;
begin
  select count(*) into before from local_evidence.egress_attempts where dest_class = 'local-placeholder';
  insert into pg_temp.t09_scratch_fanout default values;
  select count(*) into after from local_evidence.egress_attempts where dest_class = 'local-placeholder';
  select count(*) into q from net.http_request_queue;
  -- The function swallows its own errors (EXCEPTION WHEN OTHERS -> NOTICE), so a failed dispatch shows as delta 0.
  if after - before <> 1 or q <> 0 then
    raise exception 'sentinel fanout unit (synthetic scratch relation): in-transaction delta % (expected 1), queue %', after - before, q;
  end if;
end $$;
rollback;
insert into t09_sentinel_log values ('fanout-unit', 'SYNTHETIC function-unit coverage on a temporary scratch relation: in-transaction delta=1, queue=0, rolled back (not certificate->fanout integration, not delivery)');
\endif

select format('SENTINEL %s %s', step, detail) from t09_sentinel_log;
select format('SENTINEL stage %s tier %s; external delivery INTERCEPTED, NOT VERIFIED', current_setting('t09.stage'),
              case when to_regprocedure('net._t09_local_shim_marker()') is null then 'AUTHENTIC' else 'LOCAL-SHIM' end);
