-- ABOUTME: Assignment analogue of the T-09 identity follow-on, on the LOCAL snapshot: a submission belongs to one
-- ABOUTME: assignment and one learner for life. Actor is an enrolled NON-STAFF learner, distinct from the instructor.
-- Course C: a reading page and two assignments (A, B), instructor I (owns C, role instructor). Learners S and S2 have
-- role 'student' only and are enrolled in C. Course D (assignment Z) belongs to I; S is NOT enrolled in D.
-- Real triggers and RLS; learners act as `authenticated` with PostgREST claims; grading is done by I as
-- `authenticated`. No grading rule, threshold or policy is introduced; minimum submission stays as it is.
-- Synthetic rows, one transaction, rolled back.
\set ON_ERROR_STOP on
begin;
\set instr  '51111111-1111-4111-8111-111111111111'
\set stud   '53333333-3333-4333-8333-333333333333'
\set stud2  '54444444-4444-4444-8444-444444444444'
\set course 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
\set courseD 'eeeeeeee-dddd-4ddd-8ddd-eeeeeeeeeeee'
\set page   'eeeeeeee-0000-4000-8000-000000000010'
\set itemA  'eeeeeeee-0000-4000-8000-000000000011'
\set itemB  'eeeeeeee-0000-4000-8000-000000000012'
\set itemZ  'eeeeeeee-0000-4000-8000-000000000013'
\set asgA   'eeeeeeee-0000-4000-8000-000000000021'
\set asgB   'eeeeeeee-0000-4000-8000-000000000022'
\set asgZ   'eeeeeeee-0000-4000-8000-000000000023'
insert into auth.users (id, email) values (:'instr','a-instr@local.test'), (:'stud','a-stud@local.test'), (:'stud2','a-stud2@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'instr', :'stud', :'stud2') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'instr','instructor'), (:'stud','student'), (:'stud2','student') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (:'course', 'Assignment identity course', 'synthetic', 'General', 'beginner', :'instr', true),
  (:'courseD', 'Other course', 'synthetic', 'General', 'beginner', :'instr', true);
insert into public.modules (id, course_id, title, position, published) values
  ('eeeeeeee-0000-4000-8000-000000000001', :'course', 'M1', 1, true),
  ('eeeeeeee-0000-4000-8000-000000000002', :'courseD', 'MD', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (:'page',  :'course',  'eeeeeeee-0000-4000-8000-000000000001', 'page', 'Reading', 1, true),
  (:'itemA', :'course',  'eeeeeeee-0000-4000-8000-000000000001', 'assignment', 'Assignment A', 2, true),
  (:'itemB', :'course',  'eeeeeeee-0000-4000-8000-000000000001', 'assignment', 'Assignment B', 3, true),
  (:'itemZ', :'courseD', 'eeeeeeee-0000-4000-8000-000000000002', 'assignment', 'Assignment Z', 1, true);
insert into public.assignments (id, content_item_id, course_id, title) values
  (:'asgA', :'itemA', :'course', 'Assignment A'), (:'asgB', :'itemB', :'course', 'Assignment B'), (:'asgZ', :'itemZ', :'courseD', 'Assignment Z');
insert into public.enrollments (user_id, course_id) values (:'stud', :'course'), (:'stud2', :'course');

create temp table results (name text, pass boolean, detail text); grant all on results to public;
create or replace function pg_temp.as_user(p_uid uuid, p_role text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true); perform set_config('role', p_role, true); end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text) returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), p_detail); end $$;
-- an API write as p_uid, returning 'accepted (n rows)' or the error
create or replace function pg_temp.api(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare r text; n int;
begin perform pg_temp.as_user(p_uid, 'authenticated');
  begin execute p_sql; get diagnostics n = row_count; r := 'accepted (' || n || ' rows)'; exception when others then r := 'REFUSED: ' || sqlerrm; end;
  perform pg_temp.as_postgres(); return r; end $$;
create or replace function pg_temp.submit(p_uid uuid, p_asg uuid, p_body text) returns text language sql as $$
  select pg_temp.api(p_uid, format('insert into public.assignment_submissions (assignment_id, user_id, submitted_at, submission_type, body, workflow_state) values (%L, %L, now(), %L, %L, %L)', p_asg, p_uid, 'online_text_entry', p_body, 'submitted')) $$;
create or replace function pg_temp.mark(p_uid uuid, p_item uuid, p_state text) returns text language sql as $$
  select pg_temp.api(p_uid, format('insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (%L, %L, %L) on conflict (user_id, content_item_id) do update set workflow_state = excluded.workflow_state', p_uid, p_item, p_state)) $$;
create or replace function pg_temp.sub_of(p_uid uuid, p_asg uuid) returns uuid language sql as $$
  select id from public.assignment_submissions where user_id = p_uid and assignment_id = p_asg order by created_at limit 1 $$;
create or replace function pg_temp.nsubs(p_uid uuid, p_asg uuid) returns int language sql as $$
  select count(*)::int from public.assignment_submissions where user_id = p_uid and assignment_id = p_asg and submitted_at is not null $$;
create or replace function pg_temp.certs(p_uid uuid, p_course uuid) returns int language sql as $$
  select count(*)::int from public.certificates where user_id = p_uid and course_id = p_course $$;
create or replace function pg_temp.state(p_uid uuid, p_item uuid) returns text language sql as $$
  select coalesce((select workflow_state from public.content_item_progressions where user_id = p_uid and content_item_id = p_item), 'none') $$;

-- ===== preconditions: the actor is a genuinely enrolled non-staff learner, distinct from the instructor =====
select pg_temp.check('PRE actor is enrolled in C, not in D, has no staff role, and is not the instructor',
  exists (select 1 from public.enrollments where user_id = :'stud' and course_id = :'course')
  and not exists (select 1 from public.enrollments where user_id = :'stud' and course_id = :'courseD')
  and not exists (select 1 from public.user_roles where user_id = :'stud' and role in ('instructor','admin'))
  and (select instructor_id from public.courses where id = :'course') <> :'stud'::uuid
  and not exists (select 1 from public.course_instructors where user_id = :'stud'),
  'roles=' || (select string_agg(role::text, ',') from public.user_roles where user_id = :'stud'));

-- ===== P. legitimate positives (must pass before AND after any repair) =====
-- P1 certificate control: S2 submits A and B separately, completes all three items, receives exactly one certificate
select pg_temp.check('P1a learner submits A', pg_temp.submit(:'stud2', :'asgA', 'S2 answer A') like 'accepted (1%', '');
select pg_temp.check('P1b learner submits B', pg_temp.submit(:'stud2', :'asgB', 'S2 answer B') like 'accepted (1%', '');
select pg_temp.check('P1c page, A, B marked done',
  pg_temp.mark(:'stud2', :'page', 'read') like 'accepted%' and pg_temp.mark(:'stud2', :'itemA', 'completed') like 'accepted%' and pg_temp.mark(:'stud2', :'itemB', 'completed') like 'accepted%', '');
select pg_temp.check('P1d certificate control: exactly one certificate after two real submissions', pg_temp.certs(:'stud2', :'course') = 1, 'certs=' || pg_temp.certs(:'stud2', :'course'));
-- P2 learner edits and resubmits their own ungraded submission in place
-- (each write runs in its own statement; a check in the same statement would read the pre-write snapshot)
create temp table p2 as select pg_temp.api(:'stud2', format('update public.assignment_submissions set body = %L, url = %L, submitted_at = now(), attempt = coalesce(attempt,1)+1 where id = %L', 'S2 revised A', 'https://example.test/a', pg_temp.sub_of(:'stud2', :'asgA'))) as res;
select pg_temp.check('P2 learner edits own ungraded submission body/url/submitted_at in place',
  (select res from p2) = 'accepted (1 rows)' and (select body from public.assignment_submissions where id = pg_temp.sub_of(:'stud2', :'asgA')) = 'S2 revised A', (select res from p2));
-- P3 instructor grades a learner submission
create temp table p3 as select pg_temp.api(:'instr', format('update public.assignment_submissions set grade = 70, score = 70, graded_at = now(), workflow_state = %L where id = %L', 'graded', pg_temp.sub_of(:'stud2', :'asgA'))) as res;
select pg_temp.check('P3 instructor grades a submission in their course',
  (select res from p3) = 'accepted (1 rows)' and (select grade from public.assignment_submissions where id = pg_temp.sub_of(:'stud2', :'asgA')) = 70, (select res from p3));
-- P4 learner cannot raise their own grade (existing pin, unchanged)
select pg_temp.api(:'stud2', format('update public.assignment_submissions set grade = 100 where id = %L', pg_temp.sub_of(:'stud2', :'asgA')));
select pg_temp.check('P4 learner grade write is pinned (existing behaviour)', (select grade from public.assignment_submissions where id = pg_temp.sub_of(:'stud2', :'asgA')) = 70, '');

-- ===== R. identity retargets by the enrolled non-staff learner S =====
-- R1 one submission counted for two assignments and a certificate
select pg_temp.submit(:'stud', :'asgA', 'S only answer');
select pg_temp.mark(:'stud', :'page', 'read');
select pg_temp.check('R1a precondition: A marked complete after a real submission', pg_temp.mark(:'stud', :'itemA', 'completed') like 'accepted%', '');
create temp table r1 as select pg_temp.api(:'stud', format('update public.assignment_submissions set assignment_id = %L where id = %L', :'asgB', pg_temp.sub_of(:'stud', :'asgA'))) as res;
select pg_temp.check('R1b learner cannot move their submission from A to B', pg_temp.nsubs(:'stud', :'asgA') = 1 and pg_temp.nsubs(:'stud', :'asgB') = 0,
  (select res from r1) || '; subs A=' || pg_temp.nsubs(:'stud', :'asgA') || ' B=' || pg_temp.nsubs(:'stud', :'asgB'));
create temp table r1c as select pg_temp.mark(:'stud', :'itemB', 'completed') as res;
select pg_temp.check('R1c B cannot be completed without its own submission', pg_temp.state(:'stud', :'itemB') = 'none', (select res from r1c));
select pg_temp.check('R1d no certificate from a single submission', pg_temp.certs(:'stud', :'course') = 0, 'certs=' || pg_temp.certs(:'stud', :'course'));
-- reset S to a clean state for the next cases (as owner)
delete from public.certificates where user_id = :'stud'; delete from public.content_item_progressions where user_id = :'stud'; delete from public.assignment_submissions where user_id = :'stud';

-- R2 an instructor's grade on A travels with the row to B
select pg_temp.submit(:'stud', :'asgA', 'S graded answer');
select pg_temp.api(:'instr', format('update public.assignment_submissions set grade = 95, score = 95, graded_at = now(), workflow_state = %L where id = %L', 'graded', pg_temp.sub_of(:'stud', :'asgA')));
create temp table r2 as select pg_temp.api(:'stud', format('update public.assignment_submissions set assignment_id = %L where id = %L', :'asgB', pg_temp.sub_of(:'stud', :'asgA'))) as res;
select pg_temp.check('R2 a graded submission on A cannot become a graded submission on B',
  not exists (select 1 from public.assignment_submissions where user_id = :'stud' and assignment_id = :'asgB')
  and (select grade from public.assignment_submissions where user_id = :'stud' and assignment_id = :'asgA') = 95,
  (select res from r2) || '; B graded rows=' || (select count(*) from public.assignment_submissions where user_id = :'stud' and assignment_id = :'asgB' and grade is not null));
delete from public.assignment_submissions where user_id = :'stud';

-- R3 learner hands their submission to another learner (user_id retarget)
select pg_temp.submit(:'stud', :'asgA', 'S work');
create temp table r3 as select pg_temp.api(:'stud', format('update public.assignment_submissions set user_id = %L where id = %L', :'stud2', pg_temp.sub_of(:'stud', :'asgA'))) as res;
select pg_temp.check('R3 learner cannot reassign their submission to another learner',
  pg_temp.nsubs(:'stud', :'asgA') = 1 and not exists (select 1 from public.assignment_submissions where body = 'S work' and user_id = :'stud2'),
  (select res from r3) || '; S rows on A=' || pg_temp.nsubs(:'stud', :'asgA'));
delete from public.assignment_submissions where user_id = :'stud' or body = 'S work';

-- R4 learner moves a submission into a course they are not enrolled in
select pg_temp.submit(:'stud', :'asgA', 'S cross');
create temp table r4 as select pg_temp.api(:'stud', format('update public.assignment_submissions set assignment_id = %L where id = %L', :'asgZ', pg_temp.sub_of(:'stud', :'asgA'))) as res;
select pg_temp.check('R4 learner cannot move a submission into an unenrolled course',
  not exists (select 1 from public.assignment_submissions where user_id = :'stud' and assignment_id = :'asgZ'), (select res from r4));
delete from public.assignment_submissions where user_id = :'stud';

-- ===== O. observations only (recorded, NOT asserted, NOT repaired here: enrollment authorization of INSERT is a separate scope) =====
create temp table obs as select 'O1 direct INSERT of a submission for an unenrolled course: ' || pg_temp.submit(:'stud', :'asgZ', 'S direct Z') as line;
delete from public.assignment_submissions where user_id = :'stud';

select (case when pass then 'PASS ' else 'FAIL ' end) || name || case when detail <> '' then '  [' || detail || ']' else '' end from results order by name;
select line from obs;
select 'SUMMARY ' || count(*) filter (where pass) || '/' || count(*) || ' pass' from results;
rollback;
