-- ABOUTME: Sentinels for the egress guard, run against the INSTALLED net.* functions after the guard and before bootstrap
-- ABOUTME: writes, then again after migrations. Each step asserts an exact evidence delta and an empty queue, or raises.
--
-- What this proves, and what it does not:
--  * Calls through the real public net.* entry points, through the vault-reading SECURITY DEFINER callers the frozen
--    set lists, and through email_notification_fanout, each leave exactly the expected number of evidence rows while
--    net.http_request_queue stays empty. On the authentic stack that is installed pg_net; on a database carrying the
--    local shim marker every line says LOCAL-SHIM and proves nothing about pg_net.
--  * Roles are exercised only with privileges they ALREADY hold. A role that the stack denies is recorded as
--    "denied by existing privilege" with an expected delta of 0; nothing is granted to make a call possible.
--  * Committed steps persist their rows. The fanout step must run inside a transaction that is rolled back (it needs a
--    temporary trigger, which this harness never leaves behind), so its delta is measured in-transaction and is then
--    erased by design: persisted counts never cover every attempted request.
--  * External notification delivery is INTERCEPTED, NOT VERIFIED.
\set ON_ERROR_STOP 1
select set_config('t09.stack_label', 'sentinel', false) \gset t09_

create temporary table t09_sentinel_log (step text, detail text);

do $$
declare
  ph constant text := 'http://127.0.0.1:1/local-placeholder';
  tier constant text := case when to_regprocedure('net._t09_local_shim_marker()') is null then 'AUTHENTIC' else 'LOCAL-SHIM' end;
  before bigint; after bigint; q bigint; rid bigint; expected int; r text; denied boolean;
  count_now constant text := 'select count(*) from local_evidence.egress_attempts where dest_class = ''local-placeholder''';
begin
  -- 1. The public entry points, as the harness role.
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

  -- 2. Each API role, with only the privileges it already holds.
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

  -- 3. The vault-reading SECURITY DEFINER callers reachable with existing grants (service_role holds EXECUTE on both).
  --    notification_email_probe is excluded on purpose: it busy-waits up to 20 s polling net._http_response.
  execute count_now into before;
  execute 'set local role service_role';
  rid := public.notification_digest_dispatch();
  if rid is not null then raise exception 'sentinel: notification_digest_dispatch returned request id %', rid; end if;
  rid := public.coursera_call_refresh('status');
  if rid is not null then raise exception 'sentinel: coursera_call_refresh returned request id %', rid; end if;
  execute 'reset role';
  execute count_now into after; select count(*) into q from net.http_request_queue;
  if after - before <> 2 or q <> 0 then
    raise exception 'sentinel[%] vault callers as service_role: delta % (expected 2), queue %', tier, after - before, q;
  end if;
  insert into t09_sentinel_log values ('vault-callers', 'notification_digest_dispatch + coursera_call_refresh(status) as service_role: delta=2, queue=0, ids NULL');
end $$;

-- 4. email_notification_fanout. At 9cd162f its trigger is DROPPED (20260816000000_notification_email_digest.sql), so
--    no notification insert reaches it in this stack; the sentinel FAILS if the trigger is present, because that would
--    put a live notification path back. The function itself is exercised in a rolled-back transaction through a
--    temporary trigger, with its exception handler intact (a swallowed failure would show as delta 0 and fail).
do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.notifications'::regclass and not tgisinternal
             and pg_get_triggerdef(oid) ilike '%email_notification_fanout%') then
    raise exception 'sentinel: a trigger on public.notifications calls email_notification_fanout; this stack expected none at 9cd162f';
  end if;
end $$;

begin;
do $$
declare before bigint; after bigint; q bigint; uid uuid;
begin
  create trigger t09_sentinel_fanout after insert on public.notifications
    for each row execute function public.email_notification_fanout();
  select id into uid from auth.users limit 1;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (id, email) values (uid, 't09-sentinel@example.invalid');
  end if;
  select count(*) into before from local_evidence.egress_attempts where dest_class = 'local-placeholder';
  insert into public.notifications (user_id, title, message) values (uid, 't09 sentinel', 'intercepted, not delivered');
  select count(*) into after from local_evidence.egress_attempts where dest_class = 'local-placeholder';
  select count(*) into q from net.http_request_queue;
  if after - before <> 1 or q <> 0 then
    raise exception 'sentinel fanout: in-transaction delta % (expected 1), queue %', after - before, q;
  end if;
  raise notice 'sentinel fanout: in-transaction delta=1 queue=0 (rolled back next; evidence erased by design)';
end $$;
rollback;

select format('SENTINEL %s %s', step, detail) from t09_sentinel_log;
select format('SENTINEL fanout-trigger absent at 9cd162f; function exercised in a rolled-back transaction: delta=1, queue=0') ;
select format('SENTINEL tier %s; external delivery INTERCEPTED, NOT VERIFIED',
              case when to_regprocedure('net._t09_local_shim_marker()') is null then 'AUTHENTIC' else 'LOCAL-SHIM' end);
