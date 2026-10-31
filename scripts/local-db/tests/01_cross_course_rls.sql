-- ABOUTME: Role-scoped RLS test on the LOCAL snapshot database: instructor B must not read
-- ABOUTME: learner progressions / quiz submissions / quiz answers of instructor A's course.
-- Runs entirely on synthetic rows inside one transaction that is rolled back. Never run
-- against a Supabase project; the runner refuses non-loopback targets.
--
-- Output: one line per check, "PASS <name>" or "FAIL <name> (<detail>)". Exit status is
-- non-zero when any check fails (via the final RAISE).
\set ON_ERROR_STOP on
begin;

-- synthetic identities (fixed UUIDs, nothing from production)
\set instrA '11111111-1111-4111-8111-111111111111'
\set instrB '22222222-2222-4222-8222-222222222222'
\set studA  '33333333-3333-4333-8333-333333333333'
\set studB  '44444444-4444-4444-8444-444444444444'
\set admin  '55555555-5555-4555-8555-555555555555'
\set courseA 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set courseB 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

insert into auth.users (id, email) values
  (:'instrA','instr-a@local.test'), (:'instrB','instr-b@local.test'),
  (:'studA','stud-a@local.test'), (:'studB','stud-b@local.test'), (:'admin','admin@local.test');
insert into public.profiles (id) values (:'instrA'),(:'instrB'),(:'studA'),(:'studB'),(:'admin')
  on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values
  (:'instrA','instructor'),(:'instrB','instructor'),(:'studA','student'),(:'studB','student'),(:'admin','admin')
  on conflict do nothing; -- handle_new_user may already have granted 'student'

insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (:'courseA','Course A (local test)', 'synthetic', 'General', 'beginner', :'instrA', true),
  (:'courseB','Course B (local test)', 'synthetic', 'General', 'beginner', :'instrB', true);
insert into public.modules (id, course_id, title, position, published) values
  ('aaaaaaaa-0000-4000-8000-000000000001', :'courseA', 'A1', 1, true),
  ('bbbbbbbb-0000-4000-8000-000000000001', :'courseB', 'B1', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  ('aaaaaaaa-0000-4000-8000-000000000011', :'courseA', 'aaaaaaaa-0000-4000-8000-000000000001', 'quiz', 'A quiz', 1, true),
  ('bbbbbbbb-0000-4000-8000-000000000011', :'courseB', 'bbbbbbbb-0000-4000-8000-000000000001', 'quiz', 'B quiz', 1, true);
insert into public.quizzes (id, content_item_id, title) values
  ('aaaaaaaa-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000011', 'A quiz'),
  ('bbbbbbbb-0000-4000-8000-000000000021', 'bbbbbbbb-0000-4000-8000-000000000011', 'B quiz');
-- instrB is ALSO enrolled in course A as a learner. Any published course is self-enrollable
-- ("Enroll for free"), so this is the realistic cross-course read path: the instructor-role
-- clause in the SELECT policies is only reachable once the actor can read course A's
-- content_items, and enrollment grants exactly that.
insert into public.enrollments (user_id, course_id) values (:'studA', :'courseA'), (:'studB', :'courseB'), (:'instrB', :'courseA');
insert into public.quiz_submissions (id, quiz_id, user_id, attempt, workflow_state, started_at) values
  ('aaaaaaaa-0000-4000-8000-000000000031', 'aaaaaaaa-0000-4000-8000-000000000021', :'studA', 1, 'pending_review', now()),
  ('bbbbbbbb-0000-4000-8000-000000000031', 'bbbbbbbb-0000-4000-8000-000000000021', :'studB', 1, 'pending_review', now());
-- Progressions AFTER the quiz submissions: enforce_assessed_progression (BEFORE INSERT) refuses a
-- done state for a quiz with no pending_review/complete submission — observed here first as
-- "Quiz must be submitted before it can be marked complete", which is the guard doing its job.
insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values
  (:'studA', 'aaaaaaaa-0000-4000-8000-000000000011', 'read'),
  (:'studB', 'bbbbbbbb-0000-4000-8000-000000000011', 'read');

create temp table results (name text, pass boolean, detail text);

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function pg_temp.as_super() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;

create or replace function pg_temp.check_count(p_name text, p_uid uuid, p_sql text, p_expected int) returns void language plpgsql as $$
declare n int;
begin
  perform pg_temp.as_user(p_uid);
  execute p_sql into n;
  perform pg_temp.as_super();
  insert into results values (p_name, n = p_expected, format('got %s, expected %s', n, p_expected));
end $$;

-- instructor A: own course readable; course B not
select pg_temp.check_count('instrA reads own-course progressions', :'instrA',
  $q$select count(*) from public.content_item_progressions where content_item_id = 'aaaaaaaa-0000-4000-8000-000000000011'$q$, 1);
select pg_temp.check_count('instrA cannot read course-B progressions', :'instrA',
  $q$select count(*) from public.content_item_progressions where content_item_id = 'bbbbbbbb-0000-4000-8000-000000000011'$q$, 0);
-- instructor B: must not see course A learner data
select pg_temp.check_count('instrB cannot read course-A progressions', :'instrB',
  $q$select count(*) from public.content_item_progressions where content_item_id = 'aaaaaaaa-0000-4000-8000-000000000011'$q$, 0);
select pg_temp.check_count('instrB (enrolled in A) cannot read studA progression', :'instrB',
  $q$select count(*) from public.content_item_progressions where user_id = '33333333-3333-4333-8333-333333333333'$q$, 0);
select pg_temp.check_count('instrB (enrolled in A) cannot read studA quiz submission', :'instrB',
  $q$select count(*) from public.quiz_submissions where user_id = '33333333-3333-4333-8333-333333333333'$q$, 0);
select pg_temp.check_count('instrB cannot read course-A quiz submissions', :'instrB',
  $q$select count(*) from public.quiz_submissions where quiz_id = 'aaaaaaaa-0000-4000-8000-000000000021'$q$, 0);
select pg_temp.check_count('instrB reads own-course quiz submissions', :'instrB',
  $q$select count(*) from public.quiz_submissions where quiz_id = 'bbbbbbbb-0000-4000-8000-000000000021'$q$, 1);
-- students: own rows only
select pg_temp.check_count('studA reads own progression', :'studA',
  $q$select count(*) from public.content_item_progressions$q$, 1);
select pg_temp.check_count('studB cannot read studA quiz submission', :'studB',
  $q$select count(*) from public.quiz_submissions where user_id = '33333333-3333-4333-8333-333333333333'$q$, 0);
-- admin: everything
select pg_temp.check_count('admin reads all progressions', :'admin',
  $q$select count(*) from public.content_item_progressions$q$, 2);

select case when pass then 'PASS ' else 'FAIL ' end || name || case when pass then '' else ' (' || detail || ')' end as line from results order by name;
do $$ declare f int; begin select count(*) into f from results where not pass;
  if f > 0 then raise exception '% RLS check(s) failed', f; end if; end $$;
rollback;
