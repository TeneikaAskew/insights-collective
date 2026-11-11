-- ABOUTME: Behavioural test of 20261107000100_reorder_rpcs_require_course_manager on the LOCAL snapshot: who may call
-- ABOUTME: reorder_content_items and reorder_modules, and which lists they accept.
-- Tier: schema snapshot on PostgreSQL 16 with real grants and RLS; actors act as anon/authenticated with PostgREST
-- claims. Not live, not PG15, not a browser. Static source check: src/test/ci/reorderRpcOwnershipMigration.test.ts.
-- Without the migration A1-A3, A9 and V1-V4 fail by design (anyone, anon included, can rewrite positions in any
-- course, and malformed lists are applied as far as they match). Synthetic rows, one transaction, rolled back.
\set ON_ERROR_STOP on
begin;
\set owner  'b1111111-1111-4111-8111-111111111111'
\set other  'b2222222-2222-4222-8222-222222222222'
\set stud   'b3333333-3333-4333-8333-333333333333'
\set admin  'b4444444-4444-4444-8444-444444444444'
\set course 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
\set ocrs   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
\set m1     'bbbbbbbb-0000-4000-8000-000000000001'
\set m2     'bbbbbbbb-0000-4000-8000-000000000002'
\set om     'bbbbbbbb-0000-4000-8000-000000000003'
\set i1     'bbbbbbbb-0000-4000-8000-000000000011'
\set i2     'bbbbbbbb-0000-4000-8000-000000000012'
\set i3     'bbbbbbbb-0000-4000-8000-000000000013'
\set i4     'bbbbbbbb-0000-4000-8000-000000000014'
\set oi     'bbbbbbbb-0000-4000-8000-000000000015'
insert into auth.users (id, email) values (:'owner','r-owner@local.test'), (:'other','r-other@local.test'),
  (:'stud','r-stud@local.test'), (:'admin','r-admin@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'owner', :'other', :'stud', :'admin') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'owner','instructor'), (:'other','instructor'), (:'stud','student'), (:'admin','admin')
  on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (:'course','Reorder course','synthetic','General','beginner', :'owner', true),
  (:'ocrs','Other course','synthetic','General','beginner', :'other', true);
insert into public.modules (id, course_id, title, position, published) values
  (:'m1', :'course', 'S1', 0, true), (:'m2', :'course', 'S2', 1, true), (:'om', :'ocrs', 'OS1', 0, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (:'i1', :'course', :'m1', 'page', 'L1', 0, true), (:'i2', :'course', :'m1', 'page', 'L2', 1, true),
  (:'i3', :'course', :'m1', 'page', 'L3', 2, true), (:'i4', :'course', :'m2', 'page', 'L4', 0, true),
  (:'oi', :'ocrs', :'om', 'page', 'OL1', 0, true);
insert into public.enrollments (user_id, course_id) values (:'stud', :'course');

create temp table results (name text, pass boolean, detail text); grant all on results to public;
create or replace function pg_temp.as_api(p_uid uuid, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', p_role)::text
                                                else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text) returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), coalesce(p_detail, '')); end $$;
-- run p_sql as the API caller in a subtransaction; returns 'accepted' or 'REFUSED: <error>'
create or replace function pg_temp.api(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare r text;
begin perform pg_temp.as_api(p_uid, p_role);
  begin execute p_sql; r := 'accepted'; exception when others then r := 'REFUSED: ' || sqlerrm; end;
  perform pg_temp.as_postgres(); return r; end $$;
create or replace function pg_temp.lessons(p_mod uuid) returns text language sql as $$
  select string_agg(title, ',' order by position) from public.content_items where module_id = p_mod $$;
create or replace function pg_temp.sections(p_course uuid) returns text language sql as $$
  select string_agg(title, ',' order by position) from public.modules where course_id = p_course $$;
create or replace function pg_temp.items_sql(p_mod uuid, p_ids uuid[]) returns text language sql as $$
  select format('select public.reorder_content_items(%L, %L::uuid[])', p_mod, p_ids) $$;
create or replace function pg_temp.mods_sql(p_course uuid, p_ids uuid[]) returns text language sql as $$
  select format('select public.reorder_modules(%L, %L::uuid[])', p_course, p_ids) $$;

-- ===== A. Who may reorder =====
create temp table a as select
  pg_temp.api(null, 'anon', pg_temp.items_sql(:'m1', array[:'i3', :'i2', :'i1']::uuid[])) as a1i,
  pg_temp.api(null, 'anon', pg_temp.mods_sql(:'course', array[:'m2', :'m1']::uuid[])) as a1m;
grant select on a to public;
select pg_temp.check('A1 anon cannot call either reorder function',
  (select a1i like 'REFUSED%' and a1m like 'REFUSED%' from a) and pg_temp.lessons(:'m1') = 'L1,L2,L3' and pg_temp.sections(:'course') = 'S1,S2',
  (select a1i || ' | ' || a1m from a));
select pg_temp.check('A2 an enrolled student cannot reorder lessons or sections',
  pg_temp.api(:'stud', 'authenticated', pg_temp.items_sql(:'m1', array[:'i3', :'i2', :'i1']::uuid[])) like 'REFUSED%'
  and pg_temp.api(:'stud', 'authenticated', pg_temp.mods_sql(:'course', array[:'m2', :'m1']::uuid[])) like 'REFUSED%'
  and pg_temp.lessons(:'m1') = 'L1,L2,L3' and pg_temp.sections(:'course') = 'S1,S2', pg_temp.lessons(:'m1'));
select pg_temp.check('A3 another course''s instructor cannot reorder this course',
  pg_temp.api(:'other', 'authenticated', pg_temp.items_sql(:'m1', array[:'i3', :'i2', :'i1']::uuid[])) like 'REFUSED%'
  and pg_temp.api(:'other', 'authenticated', pg_temp.mods_sql(:'course', array[:'m2', :'m1']::uuid[])) like 'REFUSED%'
  and pg_temp.lessons(:'m1') = 'L1,L2,L3' and pg_temp.sections(:'course') = 'S1,S2', pg_temp.lessons(:'m1'));
select pg_temp.check('A4 the course instructor reorders lessons',
  pg_temp.api(:'owner', 'authenticated', pg_temp.items_sql(:'m1', array[:'i3', :'i1', :'i2']::uuid[])) = 'accepted'
  and pg_temp.lessons(:'m1') = 'L3,L1,L2', pg_temp.lessons(:'m1'));
select pg_temp.check('A5 the course instructor reorders sections',
  pg_temp.api(:'owner', 'authenticated', pg_temp.mods_sql(:'course', array[:'m2', :'m1']::uuid[])) = 'accepted'
  and pg_temp.sections(:'course') = 'S2,S1', pg_temp.sections(:'course'));
select pg_temp.check('A6 an admin reorders lessons in any course',
  pg_temp.api(:'admin', 'authenticated', pg_temp.items_sql(:'m1', array[:'i1', :'i2', :'i3']::uuid[])) = 'accepted'
  and pg_temp.lessons(:'m1') = 'L1,L2,L3', pg_temp.lessons(:'m1'));
select pg_temp.check('A7 service_role still reorders',
  pg_temp.api(null, 'service_role', pg_temp.mods_sql(:'course', array[:'m1', :'m2']::uuid[])) = 'accepted'
  and pg_temp.sections(:'course') = 'S1,S2', pg_temp.sections(:'course'));
select pg_temp.check('A8 positions stay 0-indexed and unique after a reorder',
  (select array_agg(position order by position) = array[0,1,2] from public.content_items where module_id = :'m1'), '');
select pg_temp.check('A9 an unknown section gets the same refusal as someone else''s, so ids are not probed',
  pg_temp.api(:'other', 'authenticated', pg_temp.items_sql(:'m1', array[:'i1', :'i2', :'i3']::uuid[]))
  = pg_temp.api(:'other', 'authenticated', pg_temp.items_sql('bbbbbbbb-0000-4000-8000-0000000000ff', array[:'i1']::uuid[]))
  and pg_temp.api(:'other', 'authenticated', pg_temp.items_sql(:'m1', array[:'i1', :'i2', :'i3']::uuid[])) like '%not allowed%',
  pg_temp.api(:'other', 'authenticated', pg_temp.items_sql(:'m1', array[:'i1', :'i2', :'i3']::uuid[])));

-- ===== V. Which lists are accepted (as the course instructor) =====
select pg_temp.check('V1 a list with a duplicate id is refused and nothing moves',
  pg_temp.api(:'owner', 'authenticated', pg_temp.items_sql(:'m1', array[:'i3', :'i3', :'i1']::uuid[])) like 'REFUSED%'
  and pg_temp.lessons(:'m1') = 'L1,L2,L3', pg_temp.lessons(:'m1'));
select pg_temp.check('V2 a partial list is refused and nothing moves',
  pg_temp.api(:'owner', 'authenticated', pg_temp.items_sql(:'m1', array[:'i2', :'i1']::uuid[])) like 'REFUSED%'
  and pg_temp.lessons(:'m1') = 'L1,L2,L3', pg_temp.lessons(:'m1'));
select pg_temp.check('V3 a lesson from another section is refused and nothing moves',
  pg_temp.api(:'owner', 'authenticated', pg_temp.items_sql(:'m1', array[:'i4', :'i2', :'i1']::uuid[])) like 'REFUSED%'
  and pg_temp.lessons(:'m1') = 'L1,L2,L3' and pg_temp.lessons(:'m2') = 'L4', pg_temp.lessons(:'m1'));
select pg_temp.check('V4 an empty or null list is refused for lessons and sections',
  pg_temp.api(:'owner', 'authenticated', pg_temp.items_sql(:'m1', array[]::uuid[])) like 'REFUSED%'
  and pg_temp.api(:'owner', 'authenticated', 'select public.reorder_content_items(''' || :'m1' || ''', null)') like 'REFUSED%'
  and pg_temp.api(:'owner', 'authenticated', pg_temp.mods_sql(:'course', array[:'m1']::uuid[])) like 'REFUSED%'
  and pg_temp.sections(:'course') = 'S1,S2', pg_temp.sections(:'course'));
select pg_temp.check('V5 the other course is untouched throughout',
  pg_temp.lessons(:'om') = 'OL1' and pg_temp.sections(:'ocrs') = 'OS1', '');

select (case when pass then 'PASS ' else 'FAIL ' end) || name || case when detail <> '' then '  [' || detail || ']' else '' end from results order by name;
select 'SUMMARY ' || count(*) filter (where pass) || '/' || count(*) || ' pass' from results;
do $$ declare n int; begin select count(*) into n from results where not pass; if n > 0 then raise exception '% check(s) FAILED', n; end if; end $$;
rollback;
