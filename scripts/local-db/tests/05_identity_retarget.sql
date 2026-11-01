-- ABOUTME: T-09 follow-on on the LOCAL snapshot: completion evidence must stay bound to its own identity. A learner
-- ABOUTME: must not move a done progression row onto an unattempted quiz, nor move a finalized attempt from quiz A to B.
-- Same course, two quizzes (A, B) and a reading page. Real triggers and RLS, the learner acting as `authenticated`
-- with PostgREST claims, finalize as service_role (what score-quiz calls). Positives use genuinely finalized
-- ZERO-score attempts: the minimum-submission policy is unchanged and no pass threshold is introduced.
-- Synthetic rows, one transaction, rolled back.
\set ON_ERROR_STOP on
begin;
\set instr '41111111-1111-4111-8111-111111111111'
\set stud  '43333333-3333-4333-8333-333333333333'
\set stud2 '44444444-4444-4444-8444-444444444444'
\set course 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set page  'dddddddd-0000-4000-8000-000000000010'
\set itemA 'dddddddd-0000-4000-8000-000000000012'
\set itemB 'dddddddd-0000-4000-8000-000000000013'
\set quizA 'dddddddd-0000-4000-8000-000000000021'
\set quizB 'dddddddd-0000-4000-8000-000000000022'
insert into auth.users (id, email) values (:'instr','r-instr@local.test'), (:'stud','r-stud@local.test'), (:'stud2','r-stud2@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'instr', :'stud', :'stud2') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'instr','instructor'), (:'stud','student'), (:'stud2','student') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values (:'course','T-09 retarget course','synthetic','General','beginner', :'instr', true);
insert into public.modules (id, course_id, title, position, published) values ('dddddddd-0000-4000-8000-000000000001', :'course', 'M1', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (:'page',  :'course', 'dddddddd-0000-4000-8000-000000000001', 'page', 'Reading', 1, true),
  (:'itemA', :'course', 'dddddddd-0000-4000-8000-000000000001', 'quiz', 'Quiz A',  2, true),
  (:'itemB', :'course', 'dddddddd-0000-4000-8000-000000000001', 'quiz', 'Quiz B',  3, true);
insert into public.quizzes (id, content_item_id, title, allowed_attempts) values (:'quizA', :'itemA', 'Quiz A', 0), (:'quizB', :'itemB', 'Quiz B', 0);
insert into public.enrollments (user_id, course_id) values (:'stud', :'course'), (:'stud2', :'course');

create temp table results (name text, pass boolean, detail text); grant all on results to public;
create or replace function pg_temp.as_user(p_uid uuid, p_role text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true); perform set_config('role', p_role, true); end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text) returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
-- learner writes, each returning 'accepted' or the error
create or replace function pg_temp.learner(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare r text := 'accepted';
begin perform pg_temp.as_user(p_uid, 'authenticated');
  begin execute p_sql; exception when others then r := 'REFUSED: ' || sqlerrm; end;
  perform pg_temp.as_postgres(); return r; end $$;
create or replace function pg_temp.mark(p_uid uuid, p_item uuid, p_state text) returns text language sql as $$
  select pg_temp.learner(p_uid, format('insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (%L, %L, %L) on conflict (user_id, content_item_id) do update set workflow_state = excluded.workflow_state', p_uid, p_item, p_state)) $$;
-- a genuinely finalized attempt: learner starts it (RPC), score-quiz finalizes it as service_role with score 0
create or replace function pg_temp.finalize_zero(p_uid uuid, p_quiz uuid) returns uuid language plpgsql as $$
declare v uuid;
begin perform pg_temp.as_user(p_uid, 'authenticated');
  select id into v from public.start_quiz_attempt(p_quiz);
  perform pg_temp.as_user('00000000-0000-0000-0000-000000000000', 'service_role');
  perform public.finalize_quiz_submission(v, 0, 5);
  perform pg_temp.as_postgres(); return v; end $$;
create or replace function pg_temp.certs(p_uid uuid) returns int language sql as $$ select count(*)::int from public.certificates where user_id = p_uid $$;
create or replace function pg_temp.state(p_uid uuid, p_item uuid) returns text language sql as $$
  select coalesce((select workflow_state from public.content_item_progressions where user_id = p_uid and content_item_id = p_item), 'none') $$;
create or replace function pg_temp.submitted(p_uid uuid, p_quiz uuid) returns int language sql as $$
  select count(*)::int from public.quiz_submissions where user_id = p_uid and quiz_id = p_quiz and workflow_state = 'complete' and finished_at is not null $$;

-- ===== P. positives: genuinely finalized zero-score attempts on both quizzes =====
select pg_temp.finalize_zero(:'stud2', :'quizA'); select pg_temp.finalize_zero(:'stud2', :'quizB');
select pg_temp.check('P1 page read, A and B finalized (score 0): all three marks accepted',
  pg_temp.mark(:'stud2', :'page', 'read') = 'accepted' and pg_temp.mark(:'stud2', :'itemA', 'completed') = 'accepted' and pg_temp.mark(:'stud2', :'itemB', 'completed') = 'accepted', '');
select pg_temp.check('P2 genuine completion of every item issues exactly one certificate', pg_temp.certs(:'stud2') = 1, format('certificates=%s', pg_temp.certs(:'stud2')));
select pg_temp.check('P3 a done row may still change state on its OWN item (completed -> read on A)',
  pg_temp.learner(:'stud2', format('update public.content_item_progressions set workflow_state = %L where user_id = %L and content_item_id = %L', 'read', :'stud2', :'itemA')) = 'accepted'
  and pg_temp.state(:'stud2', :'itemA') = 'read', pg_temp.state(:'stud2', :'itemA'));

-- ===== R1. progression retarget: a done row's content_item_id moved to the never-attempted quiz B =====
select pg_temp.finalize_zero(:'stud', :'quizA');
select pg_temp.mark(:'stud', :'page', 'read'); select pg_temp.mark(:'stud', :'itemA', 'completed');
select pg_temp.check('R1a retargeting the READ page row onto unattempted quiz B is not accepted as completion of B',
  pg_temp.learner(:'stud', format('update public.content_item_progressions set content_item_id = %L where user_id = %L and content_item_id = %L', :'itemB', :'stud', :'page')) like 'REFUSED%'
  or pg_temp.state(:'stud', :'itemB') = 'none', format('B=%s submittedB=%s', pg_temp.state(:'stud', :'itemB'), pg_temp.submitted(:'stud', :'quizB')));
select pg_temp.mark(:'stud', :'page', 'read');   -- re-read the page (allowed for a page)
select pg_temp.check('R1b ...and no certificate follows without a submitted attempt on B', pg_temp.certs(:'stud') = 0, format('certificates=%s', pg_temp.certs(:'stud')));
delete from public.certificates where user_id = :'stud'; delete from public.content_item_progressions where user_id = :'stud' and content_item_id = :'itemB';
select pg_temp.check('R1c retargeting the genuinely COMPLETED quiz A row onto unattempted quiz B is not accepted as completion of B',
  pg_temp.learner(:'stud', format('update public.content_item_progressions set content_item_id = %L where user_id = %L and content_item_id = %L', :'itemB', :'stud', :'itemA')) like 'REFUSED%'
  or pg_temp.state(:'stud', :'itemB') = 'none', format('B=%s', pg_temp.state(:'stud', :'itemB')));
delete from public.certificates where user_id = :'stud'; delete from public.content_item_progressions where user_id = :'stud';
delete from public.quiz_submissions where user_id = :'stud';

-- ===== R2. attempt retarget: a finalized attempt's quiz_id moved from A to never-attempted B =====
select pg_temp.finalize_zero(:'stud', :'quizA');
select pg_temp.learner(:'stud', format('update public.quiz_submissions set quiz_id = %L where user_id = %L and quiz_id = %L', :'quizB', :'stud', :'quizA'));
select pg_temp.check('R2a a learner UPDATE of quiz_id on a finalized attempt is not honoured (attempt stays on A, B has none)',
  pg_temp.submitted(:'stud', :'quizA') = 1 and pg_temp.submitted(:'stud', :'quizB') = 0,
  format('submittedA=%s submittedB=%s', pg_temp.submitted(:'stud', :'quizA'), pg_temp.submitted(:'stud', :'quizB')));
select pg_temp.mark(:'stud', :'page', 'read'); select pg_temp.mark(:'stud', :'itemA', 'completed');
select pg_temp.check('R2b marking never-attempted quiz B complete is REFUSED', pg_temp.mark(:'stud', :'itemB', 'completed') like 'REFUSED%', format('B=%s', pg_temp.state(:'stud', :'itemB')));
select pg_temp.check('R2c no certificate from a retargeted attempt', pg_temp.certs(:'stud') = 0, format('certificates=%s', pg_temp.certs(:'stud')));
-- R2d: moving the attempt to another learner must not succeed, whichever layer stops it (RLS refusal on the old
-- schema, the identity pin on the repaired one): the outcome is asserted, not the mechanism.
select pg_temp.learner(:'stud', format('update public.quiz_submissions set user_id = %L where user_id = %L', :'stud2', :'stud'));
select pg_temp.check('R2d user_id cannot be moved to another learner (attempt stays with its learner)',
  (select count(*) from public.quiz_submissions where user_id = :'stud') = 1 and (select count(*) from public.quiz_submissions where user_id = :'stud2') = 2,
  format('stud attempts=%s stud2 attempts=%s', (select count(*) from public.quiz_submissions where user_id = :'stud'), (select count(*) from public.quiz_submissions where user_id = :'stud2')));
-- R2e: score-quiz (service_role) still finalizes normally after the pin
select pg_temp.finalize_zero(:'stud', :'quizB');
select pg_temp.check('R2e positive: B finalized genuinely (score 0) -> B accepted and one certificate',
  pg_temp.mark(:'stud', :'itemB', 'completed') = 'accepted' and pg_temp.certs(:'stud') = 1, format('certificates=%s', pg_temp.certs(:'stud')));

select case when pass then 'PASS ' else 'FAIL ' end || name || case when pass or detail = '' then '' else ' (' || detail || ')' end as line from results order by name;
do $$ declare f int; begin select count(*) into f from results where not pass;
  if f > 0 then raise exception '% identity-retarget check(s) failed', f; end if; end $$;
rollback;
