-- ABOUTME: Extended identity kinds for the local stack: tables, columns (type|notnull|default), constraints,
-- ABOUTME: indexes, views and enums of the public schema. The reference manifest for these kinds is derived
-- ABOUTME: from applying the sanitized DDL, so it proves the DDL applies identically, NOT parity with live.
-- Version-aware view text (NARROW). PostgreSQL 15's StoreViewQuery keeps the OLD/NEW range-table entries in a
-- view's stored query, and ruleutils qualifies every column reference whenever the range table has more than one
-- entry, so on PG15 even a single-relation view prints `rel.col`. PostgreSQL 16 dropped those entries and prints a
-- single-relation view unqualified. The manifest was derived on PG16. On a server below 16, and ONLY for a view
-- whose rule depends on exactly one relation and whose text has one SELECT, no JOIN and `FROM <that relation>` as
-- its whole FROM clause, the `<relation>.` prefixes are removed before hashing. The reloptions and every other
-- character still enter the signature, so a changed definition or option still fails. Proven against the
-- captured PG15 text in scripts/local-stack/tests/view-signature.sql; the runtime PG15 output is diagnosed by
-- verify-identities.sh on any mismatch.
create or replace function pg_temp.ic_viewdef_v16form(def text, rel text, server_num int) returns text
language sql immutable as $fn$
  select case
    when server_num >= 160000 or rel is null or rel !~ '^[a-z_][a-z0-9_]*$' then def
    when def ~* '\mjoin\M' or (length(def) - length(replace(upper(def), 'SELECT', ''))) / 6 <> 1 then def
    when def !~ ('\n\s*FROM (public\.)?' || rel || '(\n|;|$)') then def
    else regexp_replace(def, '\m' || rel || '\.', '', 'g')
  end
$fn$;
with tb as (
  select 'table' as kind, c.relname::text as ident, md5(c.relkind::text) as sig from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
), col as (
  select 'column' as kind, c.relname || '.' || a.attname as ident, md5(format_type(a.atttypid, a.atttypmod) || '|' || a.attnotnull::text || '|' || coalesce(pg_get_expr(d.adbin, d.adrelid), '')) as sig
  from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relkind='r'
), cons as (
  select 'constraint' as kind, c.relname || '.' || con.conname as ident, md5(con.contype::text || '|' || pg_get_constraintdef(con.oid)) as sig
  from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
), idx as (
  select 'index' as kind, i.indexname::text as ident, md5(regexp_replace(i.indexdef, '^CREATE (UNIQUE )?INDEX (IF NOT EXISTS )?', 'CREATE \1INDEX ')) as sig
  from pg_indexes i where i.schemaname='public'
), vw as (
  select 'view' as kind, c.relname::text as ident, md5(coalesce(array_to_string(c.reloptions, ','), '') || '|' ||
         pg_temp.ic_viewdef_v16form(pg_get_viewdef(c.oid, true),
           (select case when count(distinct d.refobjid) = 1 then (select x.relname::text from pg_class x where x.oid = min(d.refobjid)) end
              from pg_depend d join pg_rewrite r on r.oid = d.objid
             where r.ev_class = c.oid and d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass and d.refobjid <> c.oid),
           current_setting('server_version_num')::int)) as sig
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'
), en as (
  select 'enum' as kind, t.typname::text as ident, md5((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)) as sig
  from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'
)
select kind || E'\t' || ident || E'\t' || sig from (select * from tb union all select * from col union all select * from cons union all select * from idx union all select * from vw union all select * from en) u order by kind, ident;
