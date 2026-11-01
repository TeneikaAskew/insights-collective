-- ABOUTME: T-09 completion integrity on the LOCAL snapshot. Drives the real paths: start_quiz_attempt (RPC, as the
-- ABOUTME: learner), learner-side writes, finalize_quiz_submission (as service_role, what score-quiz calls), then progression + certificate.
-- Requirement asserted (WP-03 §2-3, A2 prompt item 3): a quiz counts as done only after a SUBMITTED attempt; a started
-- attempt (with or without autosaved answers) is not completion proof. A learner must not be able to mark their own
-- attempt submitted. Checks tagged [decision] assert CURRENT behaviour that depends on an unmade policy choice
-- (minimum submission vs passing grade); they are not repairs. Synthetic rows, one transaction, rolled back.
\set ON_ERROR_STOP on
begin;
\set instr  '11111111-1111-4111-8111-111111111111'
\set oinstr '22222222-2222-4222-8222-222222222222'
\set stud   '33333333-3333-4333-8333-333333333333'
\set course 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set ocourse 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
insert into auth.users (id, email) values (:'instr','instr@local.test'), (:'oinstr','oinstr@local.test'), (:'stud','stud@local.test');
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'instr','instructor'), (:'oinstr','instructor'), (:'stud','student') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (:'course','T-09 course','synthetic','General','beginner', :'instr', true),
  (:'ocourse','Other course','synthetic','General','beginner', :'oinstr', true);
insert into public.modules (id, course_id, title, position, published) values ('bbbbbbbb-0000-4000-8000-000000000001', :'course', 'M1', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  ('bbbbbbbb-0000-4000-8000-000000000010', :'course', 'bbbbbbbb-0000-4000-8000-000000000001', 'page', 'Reading', 1, true),
  ('bbbbbbbb-0000-4000-8000-000000000012', :'course', 'bbbbbbbb-0000-4000-8000-000000000001', 'quiz', 'Quiz',    2, true);
insert into public.quizzes (id, content_item_id, title, allowed_attempts) values ('bbbbbbbb-0000-4000-8000-000000000021', 'bbbbbbbb-0000-4000-8000-000000000012', 'Quiz', 0);
insert into public.quiz_questions (id, quiz_id, question_text, question_type, correct_answer, points, position)
  values ('bbbbbbbb-0000-4000-8000-000000000051', 'bbbbbbbb-0000-4000-8000-000000000021', 'Q1', 'multiple_choice', '"a"', 1, 1);
insert into public.enrollments (user_id, course_id) values (:'stud', :'course'), (:'oinstr', :'course');

create temp table results (name text, pass boolean, detail text);
grant all on results to public;
create or replace function pg_temp.as_user(p_uid uuid, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  perform set_config('role', p_role, true);
end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text) returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
-- the learner (or another actor) marks the quiz item done; returns 'accepted' or the error text
create or replace function pg_temp.mark_done(p_uid uuid, p_item uuid) returns text language plpgsql as $$
declare r text := 'accepted';
begin
  perform pg_temp.as_user(p_uid, 'authenticated');
  begin
    insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (p_uid, p_item, 'completed')
      on conflict (user_id, content_item_id) do update set workflow_state = excluded.workflow_state;
  exception when others then r := 'REFUSED: ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  return r;
end $$;
create or replace function pg_temp.certs(p_uid uuid) returns int language sql as $$ select count(*)::int from public.certificates where user_id = p_uid $$;
create or replace function pg_temp.reset(p_uid uuid) returns void language plpgsql as $$
begin
  delete from public.certificates where user_id = p_uid;
  delete from public.content_item_progressions where user_id = p_uid;
  delete from public.quiz_submission_answers where quiz_submission_id in (select id from public.quiz_submissions where user_id = p_uid);
  delete from public.quiz_submissions where user_id = p_uid;
end $$;

-- The reading page is done in every scenario, so the quiz is the only remaining item and a certificate
-- is issued the moment the quiz progression is accepted.
create or replace function pg_temp.read_page(p_uid uuid) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(p_uid, 'authenticated');
  insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (p_uid, 'bbbbbbbb-0000-4000-8000-000000000010', 'read')
    on conflict (user_id, content_item_id) do nothing;
  perform pg_temp.as_postgres();
end $$;

-- ===== A. start_quiz_attempt -> pending_review -> mark complete (the reported loophole) =====
select pg_temp.read_page(:'stud');
select pg_temp.as_user(:'stud', 'authenticated');
create temp table started as select * from public.start_quiz_attempt('bbbbbbbb-0000-4000-8000-000000000021'); grant select on started to public;
select pg_temp.as_postgres();
select pg_temp.check('A0 evidence: start_quiz_attempt (learner RPC) writes workflow_state pending_review, finished_at null, 0 answers',
  (select workflow_state = 'pending_review' and finished_at is null from started)
  and (select count(*) from public.quiz_submission_answers where quiz_submission_id = (select id from started)) = 0,
  (select format('state=%s finished_at=%s', workflow_state, finished_at) from started));
select pg_temp.check('A1 started-only attempt (no answers): marking the quiz complete is REFUSED',
  pg_temp.mark_done(:'stud', 'bbbbbbbb-0000-4000-8000-000000000012') like 'REFUSED%', 'see detail column on failure');
update results set detail = (select coalesce(workflow_state,'none') from public.content_item_progressions where user_id = :'stud' and content_item_id = 'bbbbbbbb-0000-4000-8000-000000000012') where name like 'A1%';
select pg_temp.check('A2 started-only attempt: NO certificate issued', pg_temp.certs(:'stud') = 0, format('certificates=%s', pg_temp.certs(:'stud')));

-- A3: the attempt has autosaved answers but was never submitted (learner INSERT on quiz_submission_answers is allowed)
select pg_temp.reset(:'stud'); select pg_temp.read_page(:'stud');
select pg_temp.as_user(:'stud', 'authenticated');
create temp table started2 as select * from public.start_quiz_attempt('bbbbbbbb-0000-4000-8000-000000000021'); grant select on started2 to public;
insert into public.quiz_submission_answers (quiz_submission_id, quiz_question_id, answer_data) select id, 'bbbbbbbb-0000-4000-8000-000000000051', '"a"' from started2;
select pg_temp.as_postgres();
select pg_temp.check('A3 started attempt WITH autosaved answers, never submitted: marking complete is REFUSED',
  pg_temp.mark_done(:'stud', 'bbbbbbbb-0000-4000-8000-000000000012') like 'REFUSED%', format('certificates=%s', pg_temp.certs(:'stud')));
select pg_temp.check('A4 no certificate for an unsubmitted attempt with answers', pg_temp.certs(:'stud') = 0, format('certificates=%s', pg_temp.certs(:'stud')));

-- ===== B. the learner marks their own attempt submitted (UPDATE policy "Users can update their own quiz submissions") =====
select pg_temp.reset(:'stud'); select pg_temp.read_page(:'stud');
select pg_temp.as_user(:'stud', 'authenticated');
create temp table started3 as select * from public.start_quiz_attempt('bbbbbbbb-0000-4000-8000-000000000021'); grant select on started3 to public;
update public.quiz_submissions set workflow_state = 'complete', finished_at = now() where id = (select id from started3);
select pg_temp.as_postgres();
select pg_temp.check('B1 learner UPDATE to workflow_state complete is not honoured (stays unsubmitted)',
  (select workflow_state <> 'complete' and finished_at is null from public.quiz_submissions where id = (select id from started3)),
  (select format('state=%s finished_at=%s', workflow_state, finished_at) from public.quiz_submissions where id = (select id from started3)));
select pg_temp.check('B2 after the self-flip attempt, marking complete is REFUSED',
  pg_temp.mark_done(:'stud', 'bbbbbbbb-0000-4000-8000-000000000012') like 'REFUSED%', '');
select pg_temp.check('B3 no certificate after a self-flipped attempt', pg_temp.certs(:'stud') = 0, format('certificates=%s', pg_temp.certs(:'stud')));

-- B4: an instructor of ANOTHER course, enrolled here as a learner, holds the global instructor role (is_grading_staff)
select pg_temp.reset(:'oinstr'); select pg_temp.read_page(:'oinstr');
select pg_temp.as_user(:'oinstr', 'authenticated');
create temp table started4 as select * from public.start_quiz_attempt('bbbbbbbb-0000-4000-8000-000000000021'); grant select on started4 to public;
update public.quiz_submissions set workflow_state = 'complete', finished_at = now() where id = (select id from started4);
select pg_temp.as_postgres();
select pg_temp.check('B4 instructor of another course, enrolled as a learner: self-flip to complete is not honoured',
  (select workflow_state <> 'complete' from public.quiz_submissions where id = (select id from started4)),
  (select format('state=%s', workflow_state) from public.quiz_submissions where id = (select id from started4)));
select pg_temp.check('B5 ...and cannot mark the quiz complete or earn a certificate that way',
  pg_temp.mark_done(:'oinstr', 'bbbbbbbb-0000-4000-8000-000000000012') like 'REFUSED%' and pg_temp.certs(:'oinstr') = 0, format('certificates=%s', pg_temp.certs(:'oinstr')));

-- ===== C. the genuine path: submitted through finalize_quiz_submission (service_role, as score-quiz does) =====
select pg_temp.reset(:'stud'); select pg_temp.read_page(:'stud');
select pg_temp.as_user(:'stud', 'authenticated');
create temp table started5 as select * from public.start_quiz_attempt('bbbbbbbb-0000-4000-8000-000000000021'); grant select on started5 to public;
insert into public.quiz_submission_answers (quiz_submission_id, quiz_question_id, answer_data) select id, 'bbbbbbbb-0000-4000-8000-000000000051', '"a"' from started5;
select pg_temp.as_user('00000000-0000-0000-0000-000000000000', 'service_role');
select public.finalize_quiz_submission((select id from started5), 1, 30);
select pg_temp.as_postgres();
select pg_temp.check('C1 finalize_quiz_submission (service_role) sets complete + finished_at',
  (select workflow_state = 'complete' and finished_at is not null from public.quiz_submissions where id = (select id from started5)), '');
select pg_temp.check('C2 submitted attempt: marking complete is ACCEPTED', pg_temp.mark_done(:'stud', 'bbbbbbbb-0000-4000-8000-000000000012') = 'accepted', '');
select pg_temp.check('C3 submitted attempt: exactly one certificate issued', pg_temp.certs(:'stud') = 1, format('certificates=%s', pg_temp.certs(:'stud')));
select pg_temp.check('C4 re-marking complete does not issue a second certificate',
  pg_temp.mark_done(:'stud', 'bbbbbbbb-0000-4000-8000-000000000012') = 'accepted' and pg_temp.certs(:'stud') = 1, '');
select pg_temp.as_user(:'stud', 'authenticated');
select id from public.start_quiz_attempt('bbbbbbbb-0000-4000-8000-000000000021') \gset later_
select pg_temp.as_postgres();
select pg_temp.check('C5 a later started attempt does not undo the earlier submitted completion (progression stays done)',
  (select workflow_state from public.content_item_progressions where user_id = :'stud' and content_item_id = 'bbbbbbbb-0000-4000-8000-000000000012') = 'completed', '');

-- ===== D. [decision] what a SUBMITTED attempt must contain is a product policy, asserted as current behaviour =====
select pg_temp.reset(:'stud'); select pg_temp.read_page(:'stud');
select pg_temp.as_user(:'stud', 'authenticated');
create temp table started6 as select * from public.start_quiz_attempt('bbbbbbbb-0000-4000-8000-000000000021'); grant select on started6 to public;
select pg_temp.as_user('00000000-0000-0000-0000-000000000000', 'service_role');
select public.finalize_quiz_submission((select id from started6), 0, 5);
select pg_temp.as_postgres();
select pg_temp.check('D1 [decision] a submitted attempt with NO answers and score 0 currently counts as done (minimum-submission vs passing grade unresolved)',
  pg_temp.mark_done(:'stud', 'bbbbbbbb-0000-4000-8000-000000000012') = 'accepted' and pg_temp.certs(:'stud') = 1, format('certificates=%s', pg_temp.certs(:'stud')));

-- ===== E. evidence: the inline player's direct INSERT (T-08) is refused by RLS (no learner INSERT policy) =====
select pg_temp.reset(:'stud');
do $$ declare r text := 'accepted'; begin
  perform pg_temp.as_user('33333333-3333-4333-8333-333333333333', 'authenticated');
  begin insert into public.quiz_submissions (quiz_id, user_id, started_at, attempt, workflow_state)
        values ('bbbbbbbb-0000-4000-8000-000000000021', '33333333-3333-4333-8333-333333333333', now(), 1, 'pending_review');
  exception when others then r := 'REFUSED: ' || sqlerrm; end;
  perform pg_temp.as_postgres();
  insert into results values ('E1 evidence [T-08]: learner direct INSERT into quiz_submissions is refused', r like 'REFUSED%', r);
end $$;

select case when pass then 'PASS ' else 'FAIL ' end || name || case when pass or detail = '' then '' else ' (' || detail || ')' end as line from results order by name;
do $$ declare f int; begin select count(*) into f from results where not pass;
  if f > 0 then raise exception '% completion-integrity check(s) failed', f; end if; end $$;
rollback;
