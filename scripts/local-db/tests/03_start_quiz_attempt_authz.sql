-- ABOUTME: Authorization test for start_quiz_attempt on the LOCAL snapshot: only an enrolled learner
-- ABOUTME: (published quiz), the course's instructors or an admin may start an attempt. Rolled back.
-- The course's instructors include a co-instructor assigned through course_assignments (is_course_instructor). An
-- instructor-role account enrolled as a learner in a DIFFERENT course gets nothing from its role or that enrollment.
\set ON_ERROR_STOP on
begin;
\set ownerA '11111111-1111-4111-8111-111111111111'
\set ownerB '22222222-2222-4222-8222-222222222222'
\set studA  '33333333-3333-4333-8333-333333333333'
\set studB  '44444444-4444-4444-8444-444444444444'
\set admin  '55555555-5555-4555-8555-555555555555'
\set coinstrA '66666666-6666-4666-8666-666666666666'
\set enrInstrB '77777777-7777-4777-8777-777777777777'
\set courseA 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set courseB 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
insert into auth.users (id, email) values (:'ownerA','oa@local.test'),(:'ownerB','ob@local.test'),(:'studA','sa@local.test'),(:'studB','sb@local.test'),(:'admin','ad@local.test'),
  (:'coinstrA','ca@local.test'),(:'enrInstrB','eb@local.test');
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'ownerA','instructor'),(:'ownerB','instructor'),(:'studA','student'),(:'studB','student'),(:'admin','admin'),
  (:'coinstrA','instructor'),(:'enrInstrB','instructor') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values (:'courseA','A','synthetic','General','beginner', :'ownerA', true),
  (:'courseB','B','synthetic','General','beginner', :'ownerB', true);
-- co-instructor of A through course_assignments, the same way 01_cross_course_rls assigns one
insert into public.course_assignments (user_id, course_id, role) values (:'coinstrA', :'courseA', 'instructor');
insert into public.modules (id, course_id, title, position, published) values ('aaaaaaaa-0000-4000-8000-000000000001', :'courseA', 'M', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  ('aaaaaaaa-0000-4000-8000-000000000011', :'courseA', 'aaaaaaaa-0000-4000-8000-000000000001', 'quiz', 'published quiz', 1, true),
  ('aaaaaaaa-0000-4000-8000-000000000012', :'courseA', 'aaaaaaaa-0000-4000-8000-000000000001', 'quiz', 'unpublished quiz', 2, false);
insert into public.quizzes (id, content_item_id, title, allowed_attempts) values
  ('aaaaaaaa-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000011', 'published quiz', 2),
  ('aaaaaaaa-0000-4000-8000-000000000022', 'aaaaaaaa-0000-4000-8000-000000000012', 'unpublished quiz', 0);
insert into public.enrollments (user_id, course_id) values (:'studA', :'courseA'), (:'enrInstrB', :'courseB');

create temp table results (name text, pass boolean, detail text);
create or replace function pg_temp.try_start(p_name text, p_uid uuid, p_role text, p_quiz uuid, p_expect_ok boolean) returns void language plpgsql as $$
declare ok boolean := true; msg text := ''; r public.quiz_submissions;
begin
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', p_role)::text else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
  begin
    r := public.start_quiz_attempt(p_quiz);
  exception when others then ok := false; msg := sqlerrm;
  end;
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true);
  insert into results values (p_name, ok = p_expect_ok, format('%s%s, expected %s', case when ok then 'started attempt' else 'refused' end, case when ok then '' else ': ' || msg end, case when p_expect_ok then 'allowed' else 'refused' end));
end $$;

select pg_temp.try_start('enrolled studA starts published quiz (attempt 1)', :'studA', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000021', true);
select pg_temp.try_start('enrolled studA starts published quiz (attempt 2)', :'studA', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000021', true);
select pg_temp.try_start('enrolled studA refused on attempt 3 of 2',          :'studA', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000021', false);
select pg_temp.try_start('enrolled studA refused on UNPUBLISHED quiz',        :'studA', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000022', false);
select pg_temp.try_start('UNENROLLED studB refused on published quiz',        :'studB', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000021', false);
select pg_temp.try_start('UNENROLLED studB refused on unpublished quiz',      :'studB', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000022', false);
select pg_temp.try_start('course owner ownerA may start (preview)',            :'ownerA', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000021', true);
select pg_temp.try_start('other instructor ownerB refused',                    :'ownerB', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000021', false);
select pg_temp.try_start('admin may start',                                    :'admin', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000021', true);
select pg_temp.try_start('assigned co-instructor coinstrA may start (preview)', :'coinstrA', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000021', true);
select pg_temp.try_start('assigned co-instructor coinstrA may start UNPUBLISHED quiz (preview)', :'coinstrA', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000022', true);
select pg_temp.try_start('instructor enrolled only in course B refused on published quiz of A', :'enrInstrB', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000021', false);
select pg_temp.try_start('instructor enrolled only in course B refused on unpublished quiz of A', :'enrInstrB', 'authenticated', 'aaaaaaaa-0000-4000-8000-000000000022', false);
select pg_temp.try_start('anon refused',                                       null, 'anon', 'aaaaaaaa-0000-4000-8000-000000000021', false);

select case when pass then 'PASS ' else 'FAIL ' end || name || case when pass then '' else ' (' || detail || ')' end as line from results order by name;
do $$ declare f int; begin select count(*) into f from results where not pass;
  if f > 0 then raise exception '% authorization check(s) failed', f; end if; end $$;
rollback;
