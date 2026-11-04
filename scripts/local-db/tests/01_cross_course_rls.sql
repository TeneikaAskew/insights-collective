-- ABOUTME: Role-scoped RLS matrix on the LOCAL snapshot database for the three learner-data tables
-- ABOUTME: whose SELECT policies carry the global instructor clause: content_item_progressions,
-- ABOUTME: quiz_submissions, quiz_submission_answers. Eight actors × three tables × two courses.
-- Synthetic rows only, inside one transaction that is rolled back. Runners refuse non-loopback.
-- Output: "PASS <check>" / "FAIL <check> (got n, expected m)"; non-zero exit on any failure.
\set ON_ERROR_STOP on
begin;

-- actors (fixed synthetic UUIDs)
\set ownerA   '11111111-1111-4111-8111-111111111111'
\set ownerB   '22222222-2222-4222-8222-222222222222'
\set coinstrA '66666666-6666-4666-8666-666666666666'
\set enrInstr '77777777-7777-4777-8777-777777777777'
\set unrelInstr '88888888-8888-4888-8888-888888888888'
\set studA    '33333333-3333-4333-8333-333333333333'
\set studB    '44444444-4444-4444-8444-444444444444'
\set admin    '55555555-5555-4555-8555-555555555555'
\set courseA  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set courseB  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

insert into auth.users (id, email) values
  (:'ownerA','owner-a@local.test'), (:'ownerB','owner-b@local.test'), (:'coinstrA','coinstr-a@local.test'),
  (:'enrInstr','enrolled-instr@local.test'), (:'unrelInstr','unrelated-instr@local.test'),
  (:'studA','stud-a@local.test'), (:'studB','stud-b@local.test'), (:'admin','admin@local.test');
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values
  (:'ownerA','instructor'),(:'ownerB','instructor'),(:'coinstrA','instructor'),(:'enrInstr','instructor'),(:'unrelInstr','instructor'),
  (:'studA','student'),(:'studB','student'),(:'admin','admin')
  on conflict do nothing;

insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (:'courseA','Course A (local test)', 'synthetic', 'General', 'beginner', :'ownerA', true),
  (:'courseB','Course B (local test)', 'synthetic', 'General', 'beginner', :'ownerB', true);
-- co-instructor of A through course_assignments (what is_course_instructor consults)
insert into public.course_assignments (user_id, course_id, role) values (:'coinstrA', :'courseA', 'instructor');
insert into public.modules (id, course_id, title, position, published) values
  ('aaaaaaaa-0000-4000-8000-000000000001', :'courseA', 'A1', 1, true),
  ('bbbbbbbb-0000-4000-8000-000000000001', :'courseB', 'B1', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  ('aaaaaaaa-0000-4000-8000-000000000011', :'courseA', 'aaaaaaaa-0000-4000-8000-000000000001', 'quiz', 'A quiz', 1, true),
  ('bbbbbbbb-0000-4000-8000-000000000011', :'courseB', 'bbbbbbbb-0000-4000-8000-000000000001', 'quiz', 'B quiz', 1, true);
insert into public.quizzes (id, content_item_id, title) values
  ('aaaaaaaa-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000011', 'A quiz'),
  ('bbbbbbbb-0000-4000-8000-000000000021', 'bbbbbbbb-0000-4000-8000-000000000011', 'B quiz');
-- the "enrolled instructor" holds the instructor role AND is enrolled as a learner in course A:
-- any published course is self-enrollable, so this is the realistic cross-course read path.
insert into public.enrollments (user_id, course_id) values
  (:'studA', :'courseA'), (:'studB', :'courseB'), (:'enrInstr', :'courseA');
-- quiz submissions first: enforce_assessed_progression refuses a done quiz without a SUBMITTED attempt (T-09),
-- so the fixture writes them the way finalize_quiz_submission does (service_role claims, complete + finished_at).
select set_config('request.jwt.claims', '{"role":"service_role"}', true) is not null as as_service \gset
insert into public.quiz_submissions (id, quiz_id, user_id, attempt, workflow_state, started_at, finished_at) values
  ('aaaaaaaa-0000-4000-8000-000000000031', 'aaaaaaaa-0000-4000-8000-000000000021', :'studA', 1, 'complete', now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000031', 'bbbbbbbb-0000-4000-8000-000000000021', :'studB', 1, 'complete', now(), now());
select set_config('request.jwt.claims', '', true) is not null as as_postgres \gset
insert into public.quiz_questions (id, quiz_id, question_text, question_type, position) values
  ('aaaaaaaa-0000-4000-8000-000000000051', 'aaaaaaaa-0000-4000-8000-000000000021', 'A q1', 'multiple_choice', 1),
  ('bbbbbbbb-0000-4000-8000-000000000051', 'bbbbbbbb-0000-4000-8000-000000000021', 'B q1', 'multiple_choice', 1);
insert into public.quiz_submission_answers (quiz_submission_id, quiz_question_id, answer_data) values
  ('aaaaaaaa-0000-4000-8000-000000000031', 'aaaaaaaa-0000-4000-8000-000000000051', '{"v":"a"}'::jsonb),
  ('bbbbbbbb-0000-4000-8000-000000000031', 'bbbbbbbb-0000-4000-8000-000000000051', '{"v":"b"}'::jsonb);
insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values
  (:'studA', 'aaaaaaaa-0000-4000-8000-000000000011', 'read'),
  (:'studB', 'bbbbbbbb-0000-4000-8000-000000000011', 'read');

create temp table results (name text, pass boolean, detail text);
create or replace function pg_temp.as_user(p_uid uuid, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', p_role)::text else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
end $$;
create or replace function pg_temp.as_super() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.check_count(p_name text, p_uid uuid, p_role text, p_sql text, p_expected int) returns void language plpgsql as $$
declare n int;
begin
  perform pg_temp.as_user(p_uid, p_role);
  begin
    execute p_sql into n;
  exception when insufficient_privilege then n := -1; -- a grant-level denial also means "no rows"
  end;
  perform pg_temp.as_super();
  insert into results values (p_name, (n = p_expected) or (p_expected = 0 and n = -1), format('got %s, expected %s', case when n = -1 then 'permission denied' else n::text end, p_expected));
end $$;

-- Matrix: for each actor, rows visible from course A's learner (studA) in each of the three tables.
-- expected_A = 1 means may see studA's row; 0 means must not.
create temp table matrix (actor text, uid uuid, role text, expect_a int, expect_b int);
insert into matrix values
  ('ownerA',      :'ownerA',     'authenticated', 1, 0),
  ('coinstrA',    :'coinstrA',   'authenticated', 1, 0),
  ('ownerB',      :'ownerB',     'authenticated', 0, 1),
  ('enrInstr(A)', :'enrInstr',   'authenticated', 0, 0),
  ('unrelInstr',  :'unrelInstr', 'authenticated', 0, 0),
  ('studA',       :'studA',      'authenticated', 1, 0),
  ('studB',       :'studB',      'authenticated', 0, 1),
  ('admin',       :'admin',      'authenticated', 1, 1),
  ('anon',        null,          'anon',          0, 0);

do $$
declare m record; t record;
begin
  for m in select * from matrix loop
    for t in select * from (values
      ('progressions', 'select count(*) from public.content_item_progressions where user_id = %L'),
      ('quiz_submissions', 'select count(*) from public.quiz_submissions where user_id = %L'),
      ('quiz_answers', 'select count(*) from public.quiz_submission_answers a join public.quiz_submissions s on s.id = a.quiz_submission_id where s.user_id = %L')
    ) v(tbl, sqlfmt) loop
      perform pg_temp.check_count(format('%s sees studA %s', m.actor, t.tbl), m.uid, m.role, format(t.sqlfmt, '33333333-3333-4333-8333-333333333333'), m.expect_a);
      perform pg_temp.check_count(format('%s sees studB %s', m.actor, t.tbl), m.uid, m.role, format(t.sqlfmt, '44444444-4444-4444-8444-444444444444'), m.expect_b);
    end loop;
  end loop;
end $$;

select case when pass then 'PASS ' else 'FAIL ' end || name || case when pass then '' else ' (' || detail || ')' end as line from results order by name;
do $$ declare f int; begin select count(*) into f from results where not pass;
  if f > 0 then raise exception '% RLS check(s) failed', f; end if; end $$;
rollback;
