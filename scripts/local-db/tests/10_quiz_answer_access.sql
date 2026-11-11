-- ABOUTME: Behavioural test of 20261107000000_quiz_answer_key_and_learner_writes on the LOCAL snapshot: who can read
-- ABOUTME: a published quiz's answer key, what the taking RPC returns per question type, and which learner writes land.
-- Tier: schema snapshot on PostgreSQL 16 with real RLS and column privileges; actors act as anon/authenticated with
-- PostgREST claims. Not live, not PG15, not a browser. The static source check is
-- src/test/ci/quizAnswerAccessMigration.test.ts. Without the migration, K1-K6, T3, T4, W3-W5 and S1-S3 fail by design
-- (the table-wide SELECT grant returns the key columns to any learner RLS lets see the row; free-response option text
-- is served before the reveal; answers on a submitted attempt can be rewritten or deleted; timing fields move).
-- Synthetic rows, one transaction, rolled back.
\set ON_ERROR_STOP on
begin;
\set instr  'a1111111-1111-4111-8111-111111111111'
\set stud   'a3333333-3333-4333-8333-333333333333'
\set outs   'a4444444-4444-4444-8444-444444444444'
\set course 'abbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set mod    'abbbbbbb-0000-4000-8000-000000000001'
\set item   'abbbbbbb-0000-4000-8000-000000000012'
\set quiz   'abbbbbbb-0000-4000-8000-000000000021'
\set qmc    'abbbbbbb-0000-4000-8000-000000000051'
\set qfb    'abbbbbbb-0000-4000-8000-000000000052'
\set qsa    'abbbbbbb-0000-4000-8000-000000000053'
\set sdone  'abbbbbbb-0000-4000-8000-000000000061'
\set sopen  'abbbbbbb-0000-4000-8000-000000000062'
insert into auth.users (id, email) values (:'instr','k-instr@local.test'), (:'stud','k-stud@local.test'), (:'outs','k-outs@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'instr', :'stud', :'outs') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'instr','instructor'), (:'stud','student'), (:'outs','student') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (:'course','Key course','synthetic','General','beginner', :'instr', true);
insert into public.modules (id, course_id, title, position, published) values (:'mod', :'course', 'M1', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (:'item', :'course', :'mod', 'quiz', 'Quiz', 1, true);
-- two allowed attempts, so one finished attempt is NOT the reveal point
insert into public.quizzes (id, content_item_id, title, allowed_attempts, show_correct_answers) values (:'quiz', :'item', 'Quiz', 2, true);
insert into public.quiz_questions (id, quiz_id, question_text, question_type, answers, correct_answer, explanation, points, position) values
  (:'qmc', :'quiz', 'Pick one', 'multiple_choice',
     '[{"id":"a","text":"Alpha","correct":true},{"id":"b","text":"Beta","correct":false}]', null, 'Alpha is right', 1, 1),
  (:'qfb', :'quiz', 'Fill the ___', 'fill_blank',
     '[{"id":"x","text":"blank-answer","correct":true}]', null, null, 1, 2),
  (:'qsa', :'quiz', 'Say it', 'short_answer', '[]', '"short-key"', null, 1, 3);
update public.quiz_questions set options = '["short-key"]' where id = :'qsa';
insert into public.enrollments (user_id, course_id) values (:'stud', :'course');
-- one submitted attempt (with a graded answer) and one in-progress attempt, written with service_role claims (what
-- finalize uses); a claims-less insert of a 'complete' row is demoted to pending_review by the completion guard
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
insert into public.quiz_submissions (id, quiz_id, user_id, attempt, workflow_state, started_at, finished_at, score, end_at) values
  (:'sdone', :'quiz', :'stud', 1, 'complete', now() - interval '1 hour', now() - interval '50 minutes', 0, now() - interval '30 minutes'),
  (:'sopen', :'quiz', :'stud', 2, 'pending_review', now() - interval '5 minutes', null, null, now() + interval '25 minutes');
insert into public.quiz_submission_answers (quiz_submission_id, quiz_question_id, answer_data, correct, points) values
  (:'sdone', :'qmc', '{"answer":"b"}', false, 0);
select set_config('request.jwt.claims', '', true);

create temp table results (name text, pass boolean, detail text); grant all on results to public;
create or replace function pg_temp.as_api(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', 'anon')::text
                                                else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  perform set_config('role', case when p_uid is null then 'anon' else 'authenticated' end, true);
end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text) returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), coalesce(p_detail, '')); end $$;
-- run p_sql as the API caller; returns 'accepted (n rows)' or 'REFUSED: <error>'
create or replace function pg_temp.api(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare r text; n int;
begin perform pg_temp.as_api(p_uid);
  begin execute p_sql; get diagnostics n = row_count; r := 'accepted (' || n || ' rows)'; exception when others then r := 'REFUSED: ' || sqlerrm; end;
  perform pg_temp.as_postgres(); return r; end $$;
-- run a scalar text query as the API caller; NULL on any error
create or replace function pg_temp.api_val(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin perform pg_temp.as_api(p_uid);
  begin execute p_sql into v; exception when others then v := null; end;
  perform pg_temp.as_postgres(); return v; end $$;
create or replace function pg_temp.taking(p_uid uuid, p_q uuid) returns text language sql as $$
  select pg_temp.api_val(p_uid, format('select t.answers::text from public.quiz_questions q, public.get_quiz_questions_for_taking(q.quiz_id) t where q.id = %L and t.id = %L', p_q, p_q)) $$;

-- ===== K. The answer key is not readable through the table =====
create temp table k as select
  pg_temp.api(:'stud', format('select answers from public.quiz_questions where id = %L', :'qmc')) as k1,
  pg_temp.api(:'stud', format('select correct_answer from public.quiz_questions where id = %L', :'qsa')) as k2,
  pg_temp.api(:'stud', format('select explanation, feedback from public.quiz_questions where id = %L', :'qmc')) as k3,
  pg_temp.api(:'stud', format('select options from public.quiz_questions where id = %L', :'qsa')) as k4,
  pg_temp.api(:'stud', format('select * from public.quiz_questions where id = %L', :'qmc')) as k5,
  pg_temp.api(:'instr', format('select answers from public.quiz_questions where id = %L', :'qmc')) as k6,
  pg_temp.api(null, format('select id from public.quiz_questions where id = %L', :'qmc')) as k7;
grant select on k to public;
select pg_temp.check('K1 an enrolled learner cannot select answers', (select k1 like 'REFUSED%' from k), (select k1 from k));
select pg_temp.check('K2 an enrolled learner cannot select correct_answer', (select k2 like 'REFUSED%' from k), (select k2 from k));
select pg_temp.check('K3 an enrolled learner cannot select explanation or feedback', (select k3 like 'REFUSED%' from k), (select k3 from k));
select pg_temp.check('K4 an enrolled learner cannot select options', (select k4 like 'REFUSED%' from k), (select k4 from k));
select pg_temp.check('K5 select * is refused (it names the key columns)', (select k5 like 'REFUSED%' from k), (select k5 from k));
select pg_temp.check('K6 the instructor reads the key through the authoring RPC, not the table',
  (select k6 like 'REFUSED%' from k)
  and pg_temp.api_val(:'instr', format('select answers::text from public.get_quiz_questions_for_authoring(%L) where id = %L', :'quiz', :'qmc')) like '%"correct": true%',
  (select k6 from k));
select pg_temp.check('K7 anon reads nothing from quiz_questions', (select k7 like 'REFUSED%' from k), (select k7 from k));
select pg_temp.check('K8 control: the learner still reads the key-free columns of their quiz (course outline embed)',
  pg_temp.api_val(:'stud', format('select count(*)::text from (select id, quiz_id, question_text, question_type, points, position, created_at from public.quiz_questions where quiz_id = %L) s', :'quiz')) = '3', '');
select pg_temp.check('K9 control: RLS still scopes the key-free read (a learner outside the course sees 0 rows)',
  pg_temp.api_val(:'outs', format('select count(*)::text from (select id from public.quiz_questions where quiz_id = %L) s', :'quiz')) = '0', '');

-- ===== T. The taking RPC before the reveal point (1 of 2 attempts used) =====
select pg_temp.check('T1 choice question: option text served, no correct flag',
  pg_temp.taking(:'stud', :'qmc') like '%Alpha%' and pg_temp.taking(:'stud', :'qmc') not like '%correct%', pg_temp.taking(:'stud', :'qmc'));
select pg_temp.check('T2 explanation withheld before the reveal',
  pg_temp.api_val(:'stud', format('select coalesce(explanation, ''<null>'') from public.get_quiz_questions_for_taking(%L) where id = %L', :'quiz', :'qmc')) = '<null>', '');
select pg_temp.check('T3 fill-in-the-blank: accepted answer text is not served',
  coalesce(pg_temp.taking(:'stud', :'qfb'), '') not like '%blank-answer%', pg_temp.taking(:'stud', :'qfb'));
select pg_temp.check('T4 short answer (legacy options): accepted answer text is not served',
  coalesce(pg_temp.taking(:'stud', :'qsa'), '') not like '%short-key%', pg_temp.taking(:'stud', :'qsa'));
select pg_temp.check('T5 the learner outside the course gets no questions',
  pg_temp.api_val(:'outs', format('select count(*)::text from public.get_quiz_questions_for_taking(%L)', :'quiz')) = '0', '');

-- ===== W. Learner writes to quiz_submission_answers =====
create temp table w as select
  pg_temp.api(:'stud', format('insert into public.quiz_submission_answers (quiz_submission_id, quiz_question_id, answer_data) values (%L, %L, %L)', :'sopen', :'qmc', '{"answer":"a"}')) as w1,
  pg_temp.api(:'stud', format('update public.quiz_submission_answers set answer_data = %L where quiz_submission_id = %L and quiz_question_id = %L', '{"answer":"b"}', :'sopen', :'qmc')) as w2,
  pg_temp.api(:'stud', format('update public.quiz_submission_answers set answer_data = %L where quiz_submission_id = %L', '{"answer":"a"}', :'sdone')) as w3,
  pg_temp.api(:'stud', format('insert into public.quiz_submission_answers (quiz_submission_id, quiz_question_id, answer_data) values (%L, %L, %L)', :'sdone', :'qfb', '{"answer":"late"}')) as w4,
  pg_temp.api(:'stud', format('delete from public.quiz_submission_answers where quiz_submission_id = %L', :'sdone')) as w5;
grant select on w to public;
select pg_temp.check('W1 autosave into the in-progress attempt is accepted', (select w1 = 'accepted (1 rows)' from w), (select w1 from w));
select pg_temp.check('W2 changing an answer on the in-progress attempt is accepted', (select w2 = 'accepted (1 rows)' from w), (select w2 from w));
select pg_temp.check('W3 rewriting an answer on the submitted attempt changes nothing',
  (select answer_data->>'answer' from public.quiz_submission_answers where quiz_submission_id = :'sdone' and quiz_question_id = :'qmc') = 'b',
  (select w3 from w));
select pg_temp.check('W4 adding an answer to the submitted attempt is refused', (select w4 like 'REFUSED%' from w), (select w4 from w));
select pg_temp.check('W5 deleting answers from the submitted attempt removes nothing',
  (select count(*) from public.quiz_submission_answers where quiz_submission_id = :'sdone') = 1, (select w5 from w));
select pg_temp.check('W6 grading stays pinned on the learner''s own write (correct=false, points=0)',
  (select not correct and points = 0 from public.quiz_submission_answers where quiz_submission_id = :'sopen' and quiz_question_id = :'qmc'), '');

-- ===== S. Learner updates to quiz_submissions =====
create temp table s as select
  pg_temp.api(:'stud', format('update public.quiz_submissions set end_at = now() + interval ''10 days'', extra_time = 999 where id = %L', :'sopen')) as s1,
  pg_temp.api(:'stud', format('update public.quiz_submissions set extra_attempts = 9, manually_unlocked = true, attempt = 7 where id = %L', :'sopen')) as s2,
  pg_temp.api(:'stud', format('update public.quiz_submissions set started_at = now() where id = %L', :'sopen')) as s3;
grant select on s to public;
select pg_temp.check('S1 a learner cannot extend their own deadline or time',
  (select end_at < now() + interval '1 day' and coalesce(extra_time, 0) <> 999 from public.quiz_submissions where id = :'sopen'), (select s1 from s));
select pg_temp.check('S2 a learner cannot grant themselves attempts or an unlock',
  (select coalesce(extra_attempts, 0) <> 9 and coalesce(manually_unlocked, false) = false and attempt = 2 from public.quiz_submissions where id = :'sopen'), (select s2 from s));
select pg_temp.check('S3 a learner cannot move their own start time',
  (select started_at < now() - interval '1 minute' from public.quiz_submissions where id = :'sopen'), (select s3 from s));
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
update public.quiz_submissions set finished_at = now(), time_spent = 120 where id = :'sopen';
select pg_temp.as_postgres();
select pg_temp.check('S4 control: service_role (score-quiz, finalize) still writes finished_at and time_spent',
  (select finished_at is not null and time_spent = 120 from public.quiz_submissions where id = :'sopen'), '');

-- ===== R. After the reveal point (every allowed attempt finished) =====
-- finalize runs as service_role (what score-quiz calls); a claims-less update would be reverted by the completion guard
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
update public.quiz_submissions set workflow_state = 'complete' where id = :'sopen';
select pg_temp.as_postgres();
select pg_temp.check('R1 the reveal still shows the correct flag on choice options',
  pg_temp.taking(:'stud', :'qmc') like '%"correct": true%', pg_temp.taking(:'stud', :'qmc'));
select pg_temp.check('R2 the reveal shows the fill-in-the-blank answer',
  pg_temp.taking(:'stud', :'qfb') like '%blank-answer%', pg_temp.taking(:'stud', :'qfb'));
select pg_temp.check('R3 the reveal shows the explanation',
  pg_temp.api_val(:'stud', format('select explanation from public.get_quiz_questions_for_taking(%L) where id = %L', :'quiz', :'qmc')) = 'Alpha is right', '');

select (case when pass then 'PASS ' else 'FAIL ' end) || name || case when detail <> '' then '  [' || detail || ']' else '' end from results order by name;
select 'SUMMARY ' || count(*) filter (where pass) || '/' || count(*) || ' pass' from results;
do $$ declare n int; begin select count(*) into n from results where not pass; if n > 0 then raise exception '% check(s) FAILED', n; end if; end $$;
rollback;
