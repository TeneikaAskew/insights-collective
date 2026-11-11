-- ABOUTME: DB-tier rehearsal of the anonymous read negatives: impersonates PostgREST's anon role (request.jwt.claims plus
-- ABOUTME: set role anon) and REPORTS which fixture rows the actual policies return, with NO client-side filter. Rolled back.
\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select 'courses' as tbl, id, title, published, status from public.courses order by id;
select 'modules' as tbl, id, course_id, title, published from public.modules order by id;
rollback;
