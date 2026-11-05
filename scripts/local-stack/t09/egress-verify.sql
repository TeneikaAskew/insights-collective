-- ABOUTME: Re-checks the pg_net interception guard and the local-only integration state. -v stage=pre right after the guard
-- ABOUTME: (before bootstrap, queue-only); -v stage=app after bootstrap, after migrations, after controls and at teardown. Strictly read-only: it sends nothing and
-- ABOUTME: writes nothing (sentinels live in egress-sentinels.sql). Any deviation raises (ON_ERROR_STOP -> exit 3).
\set ON_ERROR_STOP 1
-- LOCAL-SHIM MODE mirrors egress-guard.sql: only with -v allow_shim=1 and the net shim marker present may the local
-- cron stand-in replace the pg_cron extension, and the result line then says LOCAL-SHIM. CI never passes allow_shim.
\if :{?allow_shim}
select set_config('t09.allow_shim', :'allow_shim', false) \gset t09_
\else
select set_config('t09.allow_shim', '0', false) \gset t09_
\endif
-- STAGE is required, with no default, so a caller can never get the weaker stage by omission.
--   pre : right after the guard, BEFORE any bootstrap write. Queue-only: design and guard identity, enable mode, owner,
--         replica proof, exclusivity, empty queue, no non-placeholder attempt, and none of the frozen vault names
--         present yet. Application functions, vault readers and cron do not exist yet and are NOT checked here.
--   app : after bootstrap (and after migrations, controls and at teardown). Everything in pre, plus the exact vault
--         name set and placeholder values, the frozen vault-reader set, and pg_cron INSTALLED (or LOCAL-SHIM) with zero
--         jobs, or proven ABSENT with no possible pg_cron scheduler for this database (see the pg_cron block).
\if :{?stage}
select set_config('t09.stage', :'stage', false) \gset t09_
\else
\echo 'egress-verify: -v stage=pre|app is required'
select 1/0 as stage_required;
\endif
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
  cron_state text; preload text; preloaded boolean; cron_db text; launchers bigint; lib text;
begin
  -- Design identity. Shim mode is accepted only when explicitly allowed; otherwise authentic pg_net is required and the
  -- shim marker must be absent. Both present is a mixed design and always fails.
  if to_regprocedure('net._t09_local_shim_marker()') is not null then
    if exists (select 1 from pg_extension where extname = 'pg_net') then
      raise exception 'egress-verify: mixed design: pg_net is installed AND the local shim marker exists';
    end if;
    if current_setting('t09.allow_shim') <> '1' then
      raise exception 'egress-verify: local shim marker present but shim mode is off (authentic pg_net required)';
    end if;
  elsif not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'egress-verify: pg_net extension is not installed';
  end if;
  if (select v from local_evidence.guard_identity where k = 'pg_net')
     is distinct from coalesce((select extversion from pg_extension where extname = 'pg_net'), 'LOCAL-SHIM')
     or (select v from local_evidence.guard_identity where k = 'pg_net_ext_oid')
     is distinct from coalesce((select oid::text from pg_extension where extname = 'pg_net'), 'LOCAL-SHIM') then
    raise exception 'egress-verify: pg_net identity changed since install (version or extension re-created)';
  end if;
  -- Guard identity: trigger present, enabled in EXACTLY the recorded mode, unchanged; function body and owner unchanged.
  select count(*) into n from pg_trigger
   where tgname = 't09_drop_http_request' and tgrelid = 'net.http_request_queue'::regclass and tgenabled in ('O', 'A');
  if n <> 1 then raise exception 'egress-verify: guard trigger missing or disabled (found %)', n; end if;
  if (select v from local_evidence.guard_identity where k = 'trigger_enabled') is distinct from
     (select tgenabled::text from pg_trigger where tgname = 't09_drop_http_request' and tgrelid = 'net.http_request_queue'::regclass) then
    raise exception 'egress-verify: guard trigger enable mode changed since install (recorded %, now %)',
      (select v from local_evidence.guard_identity where k = 'trigger_enabled'),
      (select tgenabled::text from pg_trigger where tgname = 't09_drop_http_request' and tgrelid = 'net.http_request_queue'::regclass);
  end if;
  if (select v from local_evidence.guard_identity where k = 'function_owner') is distinct from
     (select pg_get_userbyid(proowner) from pg_proc where oid = 'local_evidence.drop_http_request()'::regprocedure) then
    raise exception 'egress-verify: guard function owner changed since install';
  end if;
  if (select v from local_evidence.guard_identity where k = 'proof_md5') is distinct from
     md5(pg_get_functiondef('local_evidence.replica_mode_reachable_by(text[])'::regprocedure)) then
    raise exception 'egress-verify: replica-mode proof function changed since install';
  end if;
  -- ORIGIN mode is acceptable only while replica mode stays unreachable for every executing role; re-prove it each time.
  if (select v from local_evidence.guard_identity where k = 'trigger_enabled') = 'O' then
    declare v_why text := local_evidence.replica_mode_reachable_by(
      string_to_array((select v from local_evidence.guard_identity where k = 'executing_roles'), ','));
    begin
      if v_why is not null then raise exception 'egress-verify: trigger is ENABLE ORIGIN and replica mode is reachable: %', v_why; end if;
    end;
  end if;
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

  if current_setting('t09.stage') not in ('pre', 'app') then
    raise exception 'egress-verify: stage must be pre or app (got %)', current_setting('t09.stage');
  end if;
  if current_setting('t09.stage') = 'pre' then
    -- Nothing may have seeded the integration secrets before the guard existed.
    if to_regclass('vault.decrypted_secrets') is not null then
      select count(*) into n from vault.decrypted_secrets where name = any (expected_names);
      if n <> 0 then raise exception 'egress-verify[pre]: % frozen vault name(s) already present before bootstrap', n; end if;
    end if;
    raise notice 'egress-verify OK [pre, queue-only]: pg_net %, guard mode %, attempts local-placeholder=% other=0 (application functions, vault readers and cron NOT checked at this stage)',
      coalesce((select extversion from pg_extension where extname = 'pg_net'), 'LOCAL-SHIM'),
      (select v from local_evidence.guard_identity where k = 'trigger_enabled'),
      (select count(*) from local_evidence.egress_attempts where dest_class = 'local-placeholder');
    return;
  end if;

  -- Vault: schema present, exact name set, each exactly once, non-NULL, exactly the placeholder. Names only printed.
  if to_regclass('vault.decrypted_secrets') is null then raise exception 'egress-verify: vault.decrypted_secrets missing'; end if;
  for r in select e.nm, count(s.name) c, bool_and(s.decrypted_secret is not null and s.decrypted_secret = placeholder) ok
             from unnest(expected_names) e(nm) left join vault.decrypted_secrets s on s.name = e.nm group by e.nm loop
    if r.c <> 1 then raise exception 'egress-verify: vault name % present % times (expected 1)', r.nm, r.c; end if;
    if not r.ok then raise exception 'egress-verify: vault name % is NULL or not the local placeholder', r.nm; end if;
  end loop;
  select count(*) into n from vault.decrypted_secrets where name is null or not (name = any (expected_names));
  if n <> 0 then raise exception 'egress-verify: % vault name(s) outside the frozen set', n; end if;
  select array_agg(p.proname order by p.proname) into readers from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prokind in ('f','p') and pg_get_functiondef(p.oid) like '%decrypted_secrets%';
  if readers is distinct from (select array_agg(x order by x) from unnest(expected_readers) x) then
    raise exception 'egress-verify: vault reader functions % differ from the frozen set', readers;
  end if;

  -- pg_cron. Exactly one of three states is accepted; anything else, and any failed probe, raises.
  --   INSTALLED   the extension exists in THIS database: cron.job must exist and hold zero jobs (production shape).
  --   LOCAL-SHIM  only with allow_shim=1 and the net shim marker: the stand-in cron.job must hold zero jobs.
  --   ABSENT      the authentic `supabase start` state after a public-only snapshot (run 41321554410). Proven, not assumed:
  --               target DB : no pg_cron extension, no cron schema, and neither cron.job nor cron.job_run_details resolves.
  --               config    : when pg_cron is preloaded, cron.database_name must be readable; whenever it is defined
  --                           it must equal THIS database (the only database whose cron.job a launcher reads).
  --                           Unknown or mismatch fails. Every probe propagates its error (no missing_ok on preload).
  --               Claim: no pg_cron job can be scheduled from this database. Other databases' catalogs and any
  --               cluster-wide scheduler are NOT claimed.
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     or (current_setting('t09.allow_shim') = '1' and to_regprocedure('net._t09_local_shim_marker()') is not null) then
    if to_regclass('cron.job') is null then raise exception 'egress-verify: cron.job missing'; end if;
    select count(*) into n from cron.job;
    if n <> 0 then raise exception 'egress-verify: cron.job has % job(s) (expected 0)', n; end if;
    cron_state := coalesce('installed ' || (select extversion from pg_extension where extname = 'pg_cron'), 'LOCAL-SHIM') || ', 0 jobs';
  else
    if exists (select 1 from pg_namespace where nspname = 'cron') then
      raise exception 'egress-verify: pg_cron ABSENT but a cron schema exists in this database';
    end if;
    if to_regclass('cron.job') is not null or to_regclass('cron.job_run_details') is not null then
      raise exception 'egress-verify: pg_cron ABSENT but a cron job relation resolves in this database';
    end if;
    preload := current_setting('shared_preload_libraries');   -- no missing_ok: a failed probe raises
    -- Canonical grammar only: comma-separated entries, each trimmed of space/tab/CR/LF, each a bare name (folded to
    -- lower case, as PostgreSQL folds unquoted list items) or a double-quoted bare name (kept exactly). Anything else
    -- (a path such as $libdir/pg_cron, a suffix such as pg_cron.so, an empty entry, unbalanced or embedded quotes)
    -- makes the preload state UNKNOWN and fails closed; it is never reported as "not preloaded".
    preloaded := false;
    if btrim(preload, E' \t\r\n') <> '' then
      foreach lib in array string_to_array(preload, ',') loop
        lib := btrim(lib, E' \t\r\n');
        if lib ~ '^[A-Za-z0-9_]+$' then lib := lower(lib);
        elsif lib ~ '^"[A-Za-z0-9_]+"$' then lib := substr(lib, 2, length(lib) - 2);
        else raise exception 'egress-verify: shared_preload_libraries entry % is not a canonical library name; pg_cron preload state UNKNOWN', quote_literal(lib);
        end if;
        if lib = 'pg_cron' then preloaded := true; end if;
      end loop;
    end if;
    cron_db := current_setting('cron.database_name', true);    -- NULL only when the parameter is not defined at all
    if preloaded and cron_db is null then
      raise exception 'egress-verify: pg_cron preloaded but cron.database_name is unreadable (unknown scheduler target)';
    end if;
    if cron_db is not null and cron_db <> current_database() then
      raise exception 'egress-verify: cron.database_name is %, not this database (%); mismatch, its catalog cannot be proven empty here', cron_db, current_database();
    end if;
    launchers := (select count(*) from pg_stat_activity where backend_type = 'pg_cron launcher');
    cron_state := format('ABSENT in target db %s (extension, cron schema and job relations absent); config: pg_cron %s shared_preload_libraries, cron.database_name=%s, launcher backends %s; no pg_cron job can be scheduled from this database; other databases and any cluster-wide scheduler NOT claimed',
                         current_database(), case when preloaded then 'in' else 'not in' end, coalesce(cron_db, 'unset'), launchers);
  end if;

  raise notice 'egress-verify OK [app]: pg_net %, pg_cron %, vault names %, attempts local-placeholder=% other=0',
    coalesce((select extversion from pg_extension where extname = 'pg_net'), 'LOCAL-SHIM'),
    cron_state,
    array_length(expected_names, 1), (select count(*) from local_evidence.egress_attempts where dest_class = 'local-placeholder');
end $$;
