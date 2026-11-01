-- ABOUTME: Re-checks the pg_net interception guard and the local-only integration state. Run after bootstrap, after
-- ABOUTME: migrations, after the controls and at teardown. Read-only except the sentinels, which run in a savepoint-free
-- ABOUTME: transaction of their own and COMMIT their evidence rows. Any deviation raises (psql ON_ERROR_STOP -> exit 3).
\set ON_ERROR_STOP 1
-- The frozen vault-name set and reader-function set, computed from scripts/local-stack/schema/03_functions.sql at
-- 9cd162ff24a59142dca20b926a88139bfeb66076. A change to either is a failure here, never an automatic update.
do $$
declare
  expected_names text[] := array['coursera_refresh_secret','coursera_refresh_url','notification_digest_url',
                                 'notification_email_secret','notification_email_url'];
  expected_readers text[] := array['coursera_call_refresh','coursera_verify_refresh_secret','email_notification_fanout',
                                   'notification_digest_dispatch','notification_email_probe','notification_email_secret'];
  placeholder constant text := 'http://127.0.0.1:1/local-placeholder';
  r record; n int; readers text[];
begin
  -- Guard identity: trigger present, enabled, unchanged; function body unchanged.
  select count(*) into n from pg_trigger
   where tgname = 't09_drop_http_request' and tgrelid = 'net.http_request_queue'::regclass and tgenabled in ('O', 'A');
  if n <> 1 then raise exception 'egress-verify: guard trigger missing or disabled (found %)', n; end if;
  if (select v from local_evidence.guard_identity where k = 'function_md5')
     is distinct from md5(pg_get_functiondef('local_evidence.drop_http_request()'::regprocedure)) then
    raise exception 'egress-verify: guard function changed since install';
  end if;
  if (select v from local_evidence.guard_identity where k = 'trigger_def')
     is distinct from pg_get_triggerdef((select oid from pg_trigger where tgname = 't09_drop_http_request'
                                         and tgrelid = 'net.http_request_queue'::regclass)) then
    raise exception 'egress-verify: guard trigger definition changed since install';
  end if;
  -- No other trigger on the queue may run before ours and re-route a row.
  select count(*) into n from pg_trigger where tgrelid = 'net.http_request_queue'::regclass and not tgisinternal;
  if n <> 1 then raise exception 'egress-verify: % triggers on net.http_request_queue (expected exactly the guard)', n; end if;
  if exists (select 1 from net.http_request_queue) then raise exception 'egress-verify: net.http_request_queue is not empty'; end if;
  if exists (select 1 from local_evidence.egress_attempts where dest_class = 'other') then
    raise exception 'egress-verify: % non-placeholder destination(s) were offered to pg_net',
      (select count(*) from local_evidence.egress_attempts where dest_class = 'other');
  end if;

  -- Vault: schema present, exact name set, each exactly once, non-NULL, exactly the placeholder. Names only printed.
  if to_regclass('vault.decrypted_secrets') is null then raise exception 'egress-verify: vault.decrypted_secrets missing'; end if;
  for r in select e.nm, count(s.name) c, bool_and(s.decrypted_secret is not null and s.decrypted_secret = placeholder) ok
             from unnest(expected_names) e(nm) left join vault.decrypted_secrets s on s.name = e.nm group by e.nm loop
    if r.c <> 1 then raise exception 'egress-verify: vault name % present % times (expected 1)', r.nm, r.c; end if;
    if not r.ok then raise exception 'egress-verify: vault name % is NULL or not the local placeholder', r.nm; end if;
  end loop;
  select array_agg(p.proname order by p.proname) into readers from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prokind in ('f','p') and pg_get_functiondef(p.oid) like '%decrypted_secrets%';
  if readers is distinct from (select array_agg(x order by x) from unnest(expected_readers) x) then
    raise exception 'egress-verify: vault reader functions % differ from the frozen set', readers;
  end if;

  -- pg_cron: installed, version printed, zero jobs.
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then raise exception 'egress-verify: pg_cron not installed'; end if;
  if to_regclass('cron.job') is null then raise exception 'egress-verify: cron.job missing'; end if;
  select count(*) into n from cron.job;
  if n <> 0 then raise exception 'egress-verify: cron.job has % job(s) (expected 0)', n; end if;

  raise notice 'egress-verify OK: pg_net %, pg_cron %, vault names %, attempts local-placeholder=% other=0',
    (select extversion from pg_extension where extname = 'pg_net'), (select extversion from pg_extension where extname = 'pg_cron'),
    array_length(expected_names, 1), (select count(*) from local_evidence.egress_attempts where dest_class = 'local-placeholder');
end $$;
