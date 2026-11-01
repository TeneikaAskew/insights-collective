-- ABOUTME: Extended identity kinds for the local stack: tables, columns (type|notnull|default), constraints,
-- ABOUTME: indexes, views and enums of the public schema. The reference manifest for these kinds is derived
-- ABOUTME: from applying the sanitized DDL, so it proves the DDL applies identically, NOT parity with live.
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
  select 'view' as kind, c.relname::text as ident, md5(coalesce(array_to_string(c.reloptions, ','), '') || '|' || pg_get_viewdef(c.oid, true)) as sig
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'
), en as (
  select 'enum' as kind, t.typname::text as ident, md5((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)) as sig
  from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'
)
select kind || E'\t' || ident || E'\t' || sig from (select * from tb union all select * from col union all select * from cons union all select * from idx union all select * from vw union all select * from en) u order by kind, ident;
