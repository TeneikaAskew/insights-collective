-- ABOUTME: Behavioural test of enforce_assessed_progression and auto_issue_certificate_on_progression on
-- ABOUTME: the LOCAL snapshot: which assessment states let a progression reach a done state, and when
-- ABOUTME: a certificate is issued. Started-only quizzes are tested SEPARATELY from submitted work.
-- Synthetic rows, one transaction, rolled back. The started-only quiz checks assert the REQUIRED behaviour since
-- 20261101000200 (T-09): on the live-equivalent schema without that migration they fail by design (see 04).
\set ON_ERROR_STOP on
begin;
\set instr  '11111111-1111-4111-8111-111111111111'
\set stud   '33333333-3333-4333-8333-333333333333'
\set course 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
insert into auth.users (id, email) values (:'instr','instr@local.test'), (:'stud','stud@local.test');
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'instr','instructor'), (:'stud','student') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published)
  values (:'course','Guard course','synthetic','General','beginner', :'instr', true);
insert into public.modules (id, course_id, title, position, published) values ('aaaaaaaa-0000-4000-8000-000000000001', :'course', 'M1', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  ('aaaaaaaa-0000-4000-8000-000000000010', :'course', 'aaaaaaaa-0000-4000-8000-000000000001', 'page',       'Reading',        1, true),
  ('aaaaaaaa-0000-4000-8000-000000000011', :'course', 'aaaaaaaa-0000-4000-8000-000000000001', 'assignment', 'Assignment',     2, true),
  ('aaaaaaaa-0000-4000-8000-000000000012', :'course', 'aaaaaaaa-0000-4000-8000-000000000001', 'quiz',       'Quiz',           3, true);
insert into public.assignments (id, content_item_id, course_id, title) values ('aaaaaaaa-0000-4000-8000-000000000041', 'aaaaaaaa-0000-4000-8000-000000000011', :'course', 'Assignment');
insert into public.quizzes (id, content_item_id, title) values ('aaaaaaaa-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000012', 'Quiz');
insert into public.enrollments (user_id, course_id) values (:'stud', :'course');

create temp table results (name text, pass boolean, detail text);
create or replace function pg_temp.try_progress(p_name text, p_item uuid, p_state text, p_expect_ok boolean) returns void language plpgsql as $$
declare ok boolean := true; msg text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.content_item_progressions (user_id, content_item_id, workflow_state)
      values ('33333333-3333-4333-8333-333333333333', p_item, p_state)
      on conflict (user_id, content_item_id) do update set workflow_state = excluded.workflow_state;
  exception when others then ok := false; msg := sqlerrm;
  end;
  perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true);
  insert into results values (p_name, ok = p_expect_ok, format('write %s%s, expected %s', case when ok then 'accepted' else 'REJECTED' end, case when ok then '' else ': ' || msg end, case when p_expect_ok then 'accepted' else 'rejected' end));
end $$;
create or replace function pg_temp.cert_count() returns int language sql as $$ select count(*)::int from public.certificates where user_id = '33333333-3333-4333-8333-333333333333' $$;
create or replace function pg_temp.check_eq(p_name text, p_got anyelement, p_exp anyelement) returns void language plpgsql as $$
begin insert into results values (p_name, p_got = p_exp, format('got %s, expected %s', p_got, p_exp)); end $$;

-- 1. plain reading page: read is accepted
select pg_temp.try_progress('page: read accepted', 'aaaaaaaa-0000-4000-8000-000000000010', 'read', true);

-- 2. assignment with NO submission: every done state refused
select pg_temp.try_progress('assignment no submission: read refused',      'aaaaaaaa-0000-4000-8000-000000000011', 'read', false);
select pg_temp.try_progress('assignment no submission: completed refused', 'aaaaaaaa-0000-4000-8000-000000000011', 'completed', false);
select pg_temp.try_progress('assignment no submission: graded refused',    'aaaaaaaa-0000-4000-8000-000000000011', 'graded', false);
-- 3. assignment with a DRAFT submission row (submitted_at null): still refused
insert into public.assignment_submissions (assignment_id, user_id, attempt, workflow_state) values ('aaaaaaaa-0000-4000-8000-000000000041', :'stud', 1, 'unsubmitted');
select pg_temp.try_progress('assignment draft (submitted_at null): completed refused', 'aaaaaaaa-0000-4000-8000-000000000011', 'completed', false);
-- 4. assignment genuinely submitted: accepted
update public.assignment_submissions set workflow_state = 'submitted', submitted_at = now() where assignment_id = 'aaaaaaaa-0000-4000-8000-000000000041';
select pg_temp.try_progress('assignment submitted: completed accepted', 'aaaaaaaa-0000-4000-8000-000000000011', 'completed', true);
select pg_temp.check_eq('no certificate while quiz incomplete', pg_temp.cert_count(), 0);

-- 5. quiz with NO submission: refused
select pg_temp.try_progress('quiz no submission: completed refused', 'aaaaaaaa-0000-4000-8000-000000000012', 'completed', false);
-- 6. quiz STARTED ONLY (pending_review, no answers, no score) — tested separately from submitted work
insert into public.quiz_submissions (id, quiz_id, user_id, attempt, workflow_state, started_at)
  values ('aaaaaaaa-0000-4000-8000-000000000031', 'aaaaaaaa-0000-4000-8000-000000000021', :'stud', 1, 'pending_review', now());
select pg_temp.try_progress('[T-09] quiz started-only (pending_review, no answers): completed refused', 'aaaaaaaa-0000-4000-8000-000000000012', 'completed', false);
select pg_temp.check_eq('[T-09] no certificate after started-only quiz', pg_temp.cert_count(), 0);
-- reset to test the genuine path in isolation
delete from public.certificates where user_id = :'stud';
delete from public.content_item_progressions where user_id = :'stud' and content_item_id = 'aaaaaaaa-0000-4000-8000-000000000012';
-- submit the way score-quiz does: finalize_quiz_submission under service_role claims
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.finalize_quiz_submission('aaaaaaaa-0000-4000-8000-000000000031', 1, 10);
select set_config('request.jwt.claims', '', true);
select pg_temp.try_progress('quiz complete: completed accepted', 'aaaaaaaa-0000-4000-8000-000000000012', 'completed', true);
select pg_temp.check_eq('certificate issued once all items done (genuine path)', pg_temp.cert_count(), 1);
-- 7. idempotency: re-completing does not issue a second certificate
select pg_temp.try_progress('re-complete quiz: accepted (update of done row)', 'aaaaaaaa-0000-4000-8000-000000000012', 'completed', true);
select pg_temp.check_eq('still exactly one certificate', pg_temp.cert_count(), 1);
-- 8. done-state vocabulary: the certificate trigger ignores "graded" (counts read/completed only)
delete from public.certificates where user_id = :'stud';
update public.content_item_progressions set workflow_state = 'graded' where user_id = :'stud' and content_item_id = 'aaaaaaaa-0000-4000-8000-000000000011';
delete from public.content_item_progressions where user_id = :'stud' and content_item_id = 'aaaaaaaa-0000-4000-8000-000000000012';
select pg_temp.try_progress('quiz complete again after assignment row set to graded', 'aaaaaaaa-0000-4000-8000-000000000012', 'completed', true);
select pg_temp.check_eq('[inconsistency T-10] no certificate when an item is "graded" rather than read/completed', pg_temp.cert_count(), 0);

select case when pass then 'PASS ' else 'FAIL ' end || name || case when pass then '' else ' (' || detail || ')' end as line from results order by name;
do $$ declare f int; begin select count(*) into f from results where not pass;
  if f > 0 then raise exception '% guard check(s) failed', f; end if; end $$;
rollback;
