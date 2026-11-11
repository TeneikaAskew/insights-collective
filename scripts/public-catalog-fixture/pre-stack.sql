-- ABOUTME: Read-only DIAGNOSTIC inventory of the owned stack's outbound-capable pieces, written to evidence. It gates NOTHING:
-- ABOUTME: a prosrc pattern is not a transitive no-egress proof. The gate is the shared owner's reviewed PRE contract (pre-contract.mjs).
begin transaction read only;
select 'ext_pg_net|' || coalesce((select extversion from pg_extension where extname = 'pg_net'), 'absent');
select 'ext_http|' || coalesce((select extversion from pg_extension where extname = 'http'), 'absent');
select 'ext_dblink_fdw|' || coalesce((select string_agg(extname, ',' order by extname) from pg_extension where extname in ('dblink', 'postgres_fdw')), 'absent');
select 'seeded_table_user_triggers|' || (select count(*) from pg_trigger t where not t.tgisinternal and t.tgrelid in ('public.courses'::regclass, 'public.modules'::regclass));
rollback;
