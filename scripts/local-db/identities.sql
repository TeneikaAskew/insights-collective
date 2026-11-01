-- ABOUTME: Emits one line per schema object identity (kind<TAB>ident<TAB>md5 of definition) for the
-- ABOUTME: public schema, in the same form the live snapshot manifest was produced, so a replay can
-- ABOUTME: be verified object-by-object rather than by counts. Extension-owned functions excluded.
with fn as (
  select 'function' as kind, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as ident, md5(pg_get_functiondef(p.oid)) as sig
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')
    and not exists (select 1 from pg_depend d where d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e')
), pol as (
  select 'policy' as kind, tablename || '.' || policyname as ident, md5(cmd || '|' || permissive || '|' || array_to_string(roles, ',') || '|' || coalesce(qual,'') || '|' || coalesce(with_check,'')) as sig
  from pg_policies where schemaname='public'
), trg as (
  select 'trigger' as kind, c.relname || '.' || t.tgname as ident, md5(pg_get_triggerdef(t.oid)) as sig
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
), tg as (
  select 'table_grant' as kind, table_name || '→' || grantee as ident, md5(string_agg(privilege_type, ',' order by privilege_type)) as sig
  from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') group by table_name, grantee
), fg as (
  select 'function_grant' as kind, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as ident,
    md5(coalesce((select string_agg(r, ',' order by r) from unnest(array['anon','authenticated','service_role']) r where has_function_privilege(r, p.oid, 'EXECUTE')), '')) as sig
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and not exists (select 1 from pg_depend d where d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e')
), rls as (
  select 'rls' as kind, c.relname as ident, md5(c.relrowsecurity::text || '|' || c.relforcerowsecurity::text) as sig
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
)
select kind || E'\t' || ident || E'\t' || sig from (
  select * from fn union all select * from pol union all select * from trg union all select * from tg union all select * from fg union all select * from rls
) u order by kind, ident;
