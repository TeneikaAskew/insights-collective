-- ABOUTME: Read-only database witness: one line per table (public, auth, storage) with its row count and an md5 over every
-- ABOUTME: row's text, ordered. Run before and after the anonymous browser run; any difference means something wrote.
\set ON_ERROR_STOP on
begin transaction read only;
select t.schemaname || '.' || t.tablename as tbl,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', t.schemaname, t.tablename), false, true, '')))[1]::text as n,
       coalesce((xpath('/row/m/text()', query_to_xml(format('select md5(string_agg(x::text, E''\n'' order by x::text)) as m from %I.%I x', t.schemaname, t.tablename), false, true, '')))[1]::text, 'empty') as md5
from pg_catalog.pg_tables t
where t.schemaname in ('public', 'auth', 'storage')
order by 1;
rollback;
