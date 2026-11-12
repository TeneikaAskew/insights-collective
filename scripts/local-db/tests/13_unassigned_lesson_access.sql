-- ABOUTME: Behavioural test of unassigned lessons (content_items.module_id NULL, #184/#185) on the LOCAL snapshot:
-- ABOUTME: who may create, read, edit, reorder and delete them under the live RLS, using the builder's own queries.
-- Tier: schema snapshot on PostgreSQL 16 with real grants and RLS and the November migrations; actors act as
-- anon/authenticated with PostgREST claims. Not live, not a browser. No migration is involved: this pins what the
-- live policies already do for null-module rows. Checks tagged [current] assert existing behaviour on purpose.
-- Synthetic rows, one transaction, rolled back.
\set ON_ERROR_STOP on
begin;
\set owner  'e1111111-1111-4111-8111-111111111111'
\set coinst 'e2222222-2222-4222-8222-222222222222'
\set other  'e3333333-3333-4333-8333-333333333333'
\set stud   'e4444444-4444-4444-8444-444444444444'
\set admin  'e5555555-5555-4555-8555-555555555555'
\set course 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
\set ocrs   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'
\set mod    'eeeeeeee-0000-4000-8000-000000000001'
\set inmod  'eeeeeeee-0000-4000-8000-000000000011'
\set u1     'eeeeeeee-0000-4000-8000-000000000021'
\set u2     'eeeeeeee-0000-4000-8000-000000000022'
\set u3     'eeeeeeee-0000-4000-8000-000000000023'
insert into auth.users (id, email) values (:'owner','u-owner@local.test'), (:'coinst','u-coinst@local.test'),
  (:'other','u-other@local.test'), (:'stud','u-stud@local.test'), (:'admin','u-admin@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'owner',:'coinst',:'other',:'stud',:'admin') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'owner','instructor'), (:'coinst','instructor'), (:'other','instructor'),
  (:'stud','student'), (:'admin','admin') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (:'course','Builder course','synthetic','General','beginner', :'owner', true),
  (:'ocrs','Other course','synthetic','General','beginner', :'other', true);
insert into public.course_assignments (course_id, user_id, role) values (:'course', :'coinst', 'instructor');
insert into public.modules (id, course_id, title, position, published) values (:'mod', :'course', 'S1', 0, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (:'inmod', :'course', :'mod', 'page', 'In section', 0, true);
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
-- run p_sql as the API caller in a subtransaction; returns its first value, 'accepted', or 'REFUSED: <error>'
create or replace function pg_temp.api(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare r text;
begin perform pg_temp.as_api(p_uid, p_role);
  begin execute p_sql into r; r := coalesce(r, 'accepted'); exception when others then r := 'REFUSED: ' || sqlerrm; end;
  perform pg_temp.as_postgres(); return r; end $$;
-- The builder's unassigned read (canvasContentService.getContentItems(null, courseId)): course_id, module_id IS NULL, position then id.
create or replace function pg_temp.builder_read(p_course uuid) returns text language sql as $$
  select format('select coalesce(string_agg(title, '','' order by position, id), '''') from public.content_items where course_id = %L and module_id is null', p_course) $$;
create or replace function pg_temp.create_sql(p_id uuid, p_course uuid, p_title text, p_pos int) returns text language sql as $$
  select format('with i as (insert into public.content_items (id, course_id, module_id, type, title, position, published) values (%L, %L, null, ''page'', %L, %s, false) returning 1) select count(*)::text from i', p_id, p_course, p_title, p_pos) $$;
create or replace function pg_temp.update_sql(p_id uuid, p_title text) returns text language sql as $$
  select format('with u as (update public.content_items set title = %L where id = %L returning 1) select count(*)::text from u', p_title, p_id) $$;
create or replace function pg_temp.delete_sql(p_id uuid) returns text language sql as $$
  select format('with d as (delete from public.content_items where id = %L returning 1) select count(*)::text from d', p_id) $$;
create or replace function pg_temp.stored(p_course uuid) returns text language sql as $$
  select coalesce(string_agg(title, ',' order by position, id), '') from public.content_items where course_id = p_course and module_id is null $$;

-- ===== C. Create =====
select pg_temp.check('C1 the course owner creates an unassigned lesson',
  pg_temp.api(:'owner', 'authenticated', pg_temp.create_sql(:'u1', :'course', 'Draft A', 0)) = '1', pg_temp.stored(:'course'));
select pg_temp.check('C2 an admin creates one in any course',
  pg_temp.api(:'admin', 'authenticated', pg_temp.create_sql(:'u2', :'course', 'Draft B', 1)) = '1', pg_temp.stored(:'course'));
select pg_temp.check('C3 an instructor of another course cannot create one here',
  pg_temp.api(:'other', 'authenticated', pg_temp.create_sql(gen_random_uuid(), :'course', 'Intruder', 2)) like 'REFUSED%'
  and pg_temp.stored(:'course') = 'Draft A,Draft B', pg_temp.stored(:'course'));
select pg_temp.check('C4 a student cannot create one',
  pg_temp.api(:'stud', 'authenticated', pg_temp.create_sql(gen_random_uuid(), :'course', 'Student', 2)) like 'REFUSED%', '');
select pg_temp.check('C5 anon cannot create one',
  pg_temp.api(null, 'anon', pg_temp.create_sql(gen_random_uuid(), :'course', 'Anon', 2)) like 'REFUSED%', '');
select pg_temp.check('C6 [current] an assigned co-instructor cannot create one (insert is owner or admin only, as for section lessons)',
  pg_temp.api(:'coinst', 'authenticated', pg_temp.create_sql(gen_random_uuid(), :'course', 'Co', 2)) like 'REFUSED%', '');
select pg_temp.check('C7 two unassigned lessons may share a position (the per-section unique key ignores NULL) and the builder order breaks the tie by id',
  pg_temp.api(:'owner', 'authenticated', pg_temp.create_sql(:'u3', :'course', 'Draft C', 1)) = '1'
  and pg_temp.api(:'owner', 'authenticated', pg_temp.builder_read(:'course')) = 'Draft A,Draft B,Draft C',
  pg_temp.api(:'owner', 'authenticated', pg_temp.builder_read(:'course')));

-- ===== R. Read (the builder's own query) =====
select pg_temp.check('R1 the owner reads all three unassigned lessons and not the section lesson',
  pg_temp.api(:'owner', 'authenticated', pg_temp.builder_read(:'course')) = 'Draft A,Draft B,Draft C', '');
select pg_temp.check('R2 an assigned co-instructor reads them',
  pg_temp.api(:'coinst', 'authenticated', pg_temp.builder_read(:'course')) = 'Draft A,Draft B,Draft C', '');
select pg_temp.check('R3 an admin reads them',
  pg_temp.api(:'admin', 'authenticated', pg_temp.builder_read(:'course')) = 'Draft A,Draft B,Draft C', '');
select pg_temp.check('R4 an instructor of another course reads none',
  pg_temp.api(:'other', 'authenticated', pg_temp.builder_read(:'course')) = '', '');
select pg_temp.check('R5 an enrolled student reads none while they are unpublished',
  pg_temp.api(:'stud', 'authenticated', pg_temp.builder_read(:'course')) = '', '');
select pg_temp.check('R6 anon reads none',
  coalesce(nullif(pg_temp.api(null, 'anon', pg_temp.builder_read(:'course')), ''), 'none') in ('none') or pg_temp.api(null, 'anon', pg_temp.builder_read(:'course')) like 'REFUSED%', '');

-- ===== E. Edit and delete =====
select pg_temp.check('E1 the owner renames an unassigned lesson',
  pg_temp.api(:'owner', 'authenticated', pg_temp.update_sql(:'u1', 'Draft A1')) = '1', pg_temp.stored(:'course'));
select pg_temp.check('E2 an instructor of another course changes nothing',
  pg_temp.api(:'other', 'authenticated', pg_temp.update_sql(:'u1', 'Hijacked')) = '0'
  and pg_temp.api(:'other', 'authenticated', pg_temp.delete_sql(:'u1')) = '0', pg_temp.stored(:'course'));
select pg_temp.check('E3 [current] an assigned co-instructor changes nothing (update and delete are owner or admin only)',
  pg_temp.api(:'coinst', 'authenticated', pg_temp.update_sql(:'u1', 'Co edit')) = '0', pg_temp.stored(:'course'));
select pg_temp.check('E4 the owner cannot move an unassigned lesson into another course',
  pg_temp.api(:'owner', 'authenticated', format('update public.content_items set course_id = %L where id = %L', :'ocrs', :'u1')) like 'REFUSED%'
  and pg_temp.stored(:'course') like 'Draft A1,%', pg_temp.stored(:'course'));
select pg_temp.check('E5 the reorder RPC cannot reach unassigned lessons (it needs a section)',
  pg_temp.api(:'owner', 'authenticated', format('select public.reorder_content_items(null, array[%L, %L]::uuid[])', :'u2', :'u1')) like 'REFUSED%'
  and pg_temp.api(:'owner', 'authenticated', format('select public.reorder_content_items(%L, array[%L, %L]::uuid[])', :'mod', :'u2', :'u1')) like 'REFUSED%'
  and pg_temp.stored(:'course') = 'Draft A1,Draft B,Draft C', pg_temp.stored(:'course'));
select pg_temp.check('E6a the owner deletes the section',
  pg_temp.api(:'owner', 'authenticated', format('with d as (delete from public.modules where id = %L returning 1) select count(*)::text from d', :'mod')) = '1', '');
select pg_temp.check('E6b ...its own lesson goes with it, and the unassigned lessons stay',
  (select count(*) from public.content_items where id = :'inmod') = 0
  and pg_temp.stored(:'course') = 'Draft A1,Draft B,Draft C', pg_temp.stored(:'course'));
select pg_temp.check('E7 the owner deletes an unassigned lesson and only that one goes',
  pg_temp.api(:'owner', 'authenticated', pg_temp.delete_sql(:'u3')) = '1'
  and pg_temp.stored(:'course') = 'Draft A1,Draft B', pg_temp.stored(:'course'));

-- ===== P. Published unassigned lesson =====
select pg_temp.check('P1 [current] once published, an unassigned lesson is readable by enrolled students through the API, although the learner page never lists it',
  pg_temp.api(:'owner', 'authenticated', format('with u as (update public.content_items set published = true where id = %L returning 1) select count(*)::text from u', :'u2')) = '1'
  and pg_temp.api(:'stud', 'authenticated', pg_temp.builder_read(:'course')) = 'Draft B',
  pg_temp.api(:'stud', 'authenticated', pg_temp.builder_read(:'course')));

select (case when pass then 'PASS ' else 'FAIL ' end) || name || case when detail <> '' then '  [' || detail || ']' else '' end from results order by name;
select 'SUMMARY ' || count(*) filter (where pass) || '/' || count(*) || ' pass' from results;
do $$ declare n int; begin select count(*) into n from results where not pass; if n > 0 then raise exception '% check(s) FAILED', n; end if; end $$;
rollback;
