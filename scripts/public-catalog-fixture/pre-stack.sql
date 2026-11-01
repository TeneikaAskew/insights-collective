-- ABOUTME: Read-only PRE check of the owned stack, run before W0 and the seed: no outbound-capable extension and no trigger on
-- ABOUTME: the seeded tables that could reach the network or a mailer. Prints one "name|ok" or "name|FAIL" row per check.
-- The lane itself sends no GoTrue request, so the only mail paths are DB-side (pg_net/http/dblink, supabase_functions hooks).
begin transaction read only;
select 'ext_pg_net|' || case when exists (select 1 from pg_extension where extname = 'pg_net') then 'FAIL' else 'ok' end;
select 'ext_http|' || case when exists (select 1 from pg_extension where extname = 'http') then 'FAIL' else 'ok' end;
select 'ext_dblink|' || case when exists (select 1 from pg_extension where extname in ('dblink', 'postgres_fdw')) then 'FAIL' else 'ok' end;
select 'trigger_egress|' || case when exists (
  select 1 from pg_trigger t join pg_proc f on f.oid = t.tgfoid
  where not t.tgisinternal and t.tgrelid in ('public.courses'::regclass, 'public.modules'::regclass)
    and f.prosrc ~* '(net\.|http_|supabase_functions|pg_net|dblink|pg_notify|mail)'
) then 'FAIL' else 'ok' end;
rollback;
