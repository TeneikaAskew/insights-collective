-- ABOUTME: T-09 follow-on on the LOCAL snapshot: a learner's own-row writes must also be authorized for their TARGET
-- ABOUTME: (enrolled course, visible item), and a NEW certificate needs genuine evidence for every required assessment.
-- Tier: schema snapshot applied to PostgreSQL 16 with real triggers and RLS. Not live, not PG15, not a browser.
-- Actors act with their real API role (authenticated + PostgREST claims); maintenance controls use postgres (no
-- claims) and service_role explicitly. Course C (owner I): page P, assignment A, hidden (unpublished) assignment H,
-- unlinked assignment U (no content item). Course D (owner J): page PD, assignment Z. S and S2 are 'student' only;
-- S is enrolled in C only. Course E (S2 enrolled): page EP, assignment EA, quiz EQ with legacy-invalid done rows.
-- Course F (S2 enrolled): page FP, assignment FA with a legacy done row backed by a genuine submission.
-- No grading rule, threshold or historical correction. Synthetic rows, one transaction, rolled back. Any FAIL makes
-- psql exit non-zero.
\set ON_ERROR_STOP on
begin;
\set I   '61111111-1111-4111-8111-111111111111'
\set J   '62222222-2222-4222-8222-222222222222'
\set S   '63333333-3333-4333-8333-333333333333'
\set S2  '64444444-4444-4444-8444-444444444444'
\set C   'f0000000-0000-4000-8000-0000000000c0'
\set D   'f0000000-0000-4000-8000-0000000000d0'
\set E   'f0000000-0000-4000-8000-0000000000e0'
\set F   'f0000000-0000-4000-8000-0000000000f0'
\set P   'f0000000-0000-4000-8000-0000000000c1'
\set iA  'f0000000-0000-4000-8000-0000000000c2'
\set iH  'f0000000-0000-4000-8000-0000000000c3'
\set PD  'f0000000-0000-4000-8000-0000000000d1'
\set iZ  'f0000000-0000-4000-8000-0000000000d2'
\set EP  'f0000000-0000-4000-8000-0000000000e1'
\set iEA 'f0000000-0000-4000-8000-0000000000e2'
\set iEQ 'f0000000-0000-4000-8000-0000000000e3'
\set FP  'f0000000-0000-4000-8000-0000000000f1'
\set iFA 'f0000000-0000-4000-8000-0000000000f2'
\set aA  'f0000000-0000-4000-8000-0000000001c2'
\set aH  'f0000000-0000-4000-8000-0000000001c3'
\set aU  'f0000000-0000-4000-8000-0000000001c4'
\set aW  'f0000000-0000-4000-8000-0000000001c5'
\set aZ  'f0000000-0000-4000-8000-0000000001d2'
\set aEA 'f0000000-0000-4000-8000-0000000001e2'
\set qEQ 'f0000000-0000-4000-8000-0000000002e3'
\set aFA 'f0000000-0000-4000-8000-0000000001f2'
insert into auth.users (id, email) values (:'I','t-i@local.test'), (:'J','t-j@local.test'), (:'S','t-s@local.test'), (:'S2','t-s2@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'I', :'J', :'S', :'S2') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'I','instructor'), (:'J','instructor'), (:'S','student'), (:'S2','student') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (:'C','Course C','s','General','beginner', :'I', true), (:'D','Course D','s','General','beginner', :'J', true),
  (:'E','Course E','s','General','beginner', :'I', true), (:'F','Course F','s','General','beginner', :'I', true);
insert into public.modules (id, course_id, title, position, published) values
  ('f0000000-0000-4000-8000-0000000000ca', :'C', 'MC', 1, true), ('f0000000-0000-4000-8000-0000000000da', :'D', 'MD', 1, true),
  ('f0000000-0000-4000-8000-0000000000ea', :'E', 'ME', 1, true), ('f0000000-0000-4000-8000-0000000000fa', :'F', 'MF', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (:'P',  :'C', 'f0000000-0000-4000-8000-0000000000ca', 'page', 'P', 1, true),
  (:'iA', :'C', 'f0000000-0000-4000-8000-0000000000ca', 'assignment', 'A', 2, true),
  (:'iH', :'C', 'f0000000-0000-4000-8000-0000000000ca', 'assignment', 'H hidden', 3, false),
  (:'PD', :'D', 'f0000000-0000-4000-8000-0000000000da', 'page', 'PD', 1, true),
  (:'iZ', :'D', 'f0000000-0000-4000-8000-0000000000da', 'assignment', 'Z', 2, true),
  (:'EP', :'E', 'f0000000-0000-4000-8000-0000000000ea', 'page', 'EP', 1, true),
  (:'iEA',:'E', 'f0000000-0000-4000-8000-0000000000ea', 'assignment', 'EA', 2, true),
  (:'iEQ',:'E', 'f0000000-0000-4000-8000-0000000000ea', 'quiz', 'EQ', 3, true),
  (:'FP', :'F', 'f0000000-0000-4000-8000-0000000000fa', 'page', 'FP', 1, true),
  (:'iFA',:'F', 'f0000000-0000-4000-8000-0000000000fa', 'assignment', 'FA', 2, true);
insert into public.assignments (id, content_item_id, course_id, title) values
  (:'aA', :'iA', :'C', 'A'), (:'aH', :'iH', :'C', 'H'), (:'aU', null, :'C', 'U unlinked'), (:'aW', null, :'C', 'W unlinked'), (:'aZ', :'iZ', :'D', 'Z'),
  (:'aEA', :'iEA', :'E', 'EA'), (:'aFA', :'iFA', :'F', 'FA');
insert into public.quizzes (id, content_item_id, title, allowed_attempts) values (:'qEQ', :'iEQ', 'EQ', 0);
insert into public.enrollments (user_id, course_id) values (:'S', :'C'), (:'S2', :'C'), (:'S2', :'E'), (:'S2', :'F');

create temp table results (name text, pass boolean, detail text); grant all on results to public;
create or replace function pg_temp.as_user(p_uid uuid, p_role text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true); perform set_config('role', p_role, true); end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text) returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), coalesce(p_detail, '')); end $$;
create or replace function pg_temp.api(p_uid uuid, p_sql text, p_role text default 'authenticated') returns text language plpgsql as $$
declare r text; n int;
begin perform pg_temp.as_user(p_uid, p_role);
  begin execute p_sql; get diagnostics n = row_count; r := 'accepted (' || n || ' rows)'; exception when others then r := 'REFUSED: ' || sqlerrm; end;
  perform pg_temp.as_postgres(); return r; end $$;
-- a read as the real role, returning a count
create or replace function pg_temp.api_count(p_uid uuid, p_sql text) returns int language plpgsql as $$
declare n int; begin perform pg_temp.as_user(p_uid, 'authenticated'); execute p_sql into n; perform pg_temp.as_postgres(); return n; end $$;
create or replace function pg_temp.submit_as(p_uid uuid, p_for uuid, p_asg uuid, p_body text) returns text language sql as $$
  select pg_temp.api(p_uid, format('insert into public.assignment_submissions (assignment_id, user_id, submitted_at, submission_type, body, workflow_state) values (%L, %L, now(), %L, %L, %L)', p_asg, p_for, 'online_text_entry', p_body, 'submitted')) $$;
create or replace function pg_temp.mark_as(p_uid uuid, p_for uuid, p_item uuid, p_state text) returns text language sql as $$
  select pg_temp.api(p_uid, format('insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (%L, %L, %L) on conflict (user_id, content_item_id) do update set workflow_state = excluded.workflow_state', p_for, p_item, p_state)) $$;
create or replace function pg_temp.nsub(p_uid uuid, p_asg uuid) returns int language sql as $$ select count(*)::int from public.assignment_submissions where user_id = p_uid and assignment_id = p_asg $$;
create or replace function pg_temp.nprog(p_uid uuid, p_item uuid) returns int language sql as $$ select count(*)::int from public.content_item_progressions where user_id = p_uid and content_item_id = p_item $$;
create or replace function pg_temp.certs(p_uid uuid, p_course uuid) returns int language sql as $$ select count(*)::int from public.certificates where user_id = p_uid and course_id = p_course $$;
create or replace function pg_temp.notes(p_uid uuid) returns int language sql as $$ select count(*)::int from public.notifications where user_id = p_uid $$;
create temp table st as select pg_temp.notes(:'J') as j0, pg_temp.notes(:'I') as i0;

-- ===== precondition =====
select pg_temp.check('PRE actors: S/S2 student only, S enrolled in C only, I owns C/E/F, J owns D only',
  (select string_agg(role::text, ',') from public.user_roles where user_id = :'S') = 'student'
  and (select count(*) from public.enrollments where user_id = :'S') = 1
  and (select instructor_id from public.courses where id = :'D') = :'J'::uuid, '');

-- ===== F. forbidden learner writes: no submission, progress, notification or certificate =====
create temp table f1 as select pg_temp.submit_as(:'S', :'S', :'aZ', 'unenrolled') as r;
select pg_temp.check('F1 no submission into an unenrolled course (Z in D)', pg_temp.nsub(:'S', :'aZ') = 0, (select r from f1));
create temp table f2 as select pg_temp.submit_as(:'S', :'S', :'aH', 'hidden') as r;
select pg_temp.check('F2 no submission to a hidden (unpublished) item in an enrolled course', pg_temp.nsub(:'S', :'aH') = 0, (select r from f2));
create temp table f3 as select pg_temp.submit_as(:'S', :'S2', :'aA', 'for someone else') as r;
select pg_temp.check('F3 no submission on behalf of another learner', pg_temp.nsub(:'S2', :'aA') = 0, (select r from f3));
select pg_temp.check('F4 no notification to D''s instructor from refused writes', pg_temp.notes(:'J') = (select j0 from st), 'J notifications delta=' || (pg_temp.notes(:'J') - (select j0 from st)));
create temp table f5 as select pg_temp.mark_as(:'S', :'S', :'PD', 'read') as r;
select pg_temp.check('F5 no progress on a page of an unenrolled course', pg_temp.nprog(:'S', :'PD') = 0, (select r from f5));
create temp table f6 as select pg_temp.mark_as(:'S', :'S', :'iH', 'completed') as r;
select pg_temp.check('F6 no progress on a hidden item', pg_temp.nprog(:'S', :'iH') = 0, (select r from f6));
-- each case starts from a clean target, so an earlier failure cannot make a later case pass or fail vacuously
delete from public.content_item_progressions where user_id = :'S' and content_item_id = :'PD';
select pg_temp.mark_as(:'S', :'S', :'P', 'read');
create temp table f7 as select pg_temp.api(:'S', format('update public.content_item_progressions set content_item_id = %L where user_id = %L and content_item_id = %L', :'PD', :'S', :'P')) as r;
select pg_temp.check('F7 own progress row cannot be moved onto an unenrolled course''s page', pg_temp.nprog(:'S', :'PD') = 0 and pg_temp.nprog(:'S', :'P') = 1, (select r from f7));
create temp table f8 as select pg_temp.mark_as(:'S', :'S2', :'P', 'read') as r;
select pg_temp.check('F8 no progress written for another learner', pg_temp.nprog(:'S2', :'P') = 0, (select r from f8));
select pg_temp.check('F9 no certificate in D for S', pg_temp.certs(:'S', :'D') = 0, 'certs=' || pg_temp.certs(:'S', :'D'));

-- ===== P. authorized behaviour that must keep working =====
create temp table p1 as select pg_temp.submit_as(:'S', :'S', :'aA', 'S answer') as r;
select pg_temp.check('P1 enrolled learner submits a visible assignment', pg_temp.nsub(:'S', :'aA') = 1, (select r from p1));
create temp table p2 as select pg_temp.api(:'S', format('update public.assignment_submissions set body = %L, submitted_at = now() where user_id = %L and assignment_id = %L', 'S revised', :'S', :'aA')) as r;
select pg_temp.check('P2 learner edits and resubmits their own submission', (select r from p2) = 'accepted (1 rows)' and (select body from public.assignment_submissions where user_id = :'S' and assignment_id = :'aA') = 'S revised', (select r from p2));
create temp table p3 as select pg_temp.submit_as(:'S', :'S', :'aU', 'unlinked') as r;
select pg_temp.check('P3 enrolled learner submits an unlinked assignment of their course', pg_temp.nsub(:'S', :'aU') = 1, (select r from p3));
select pg_temp.mark_as(:'S', :'S', :'P', 'read');
create temp table p4 as select pg_temp.mark_as(:'S', :'S', :'iA', 'completed') as r;
select pg_temp.check('P4 completion with a genuine submission issues the course certificate', pg_temp.certs(:'S', :'C') = 1, (select r from p4) || '; certs=' || pg_temp.certs(:'S', :'C'));
create temp table p5 as select pg_temp.api(:'I', format('update public.assignment_submissions set grade = 80, score = 80, graded_at = now(), workflow_state = %L where user_id = %L and assignment_id = %L', 'graded', :'S', :'aA')) as r;
select pg_temp.check('P5 the course''s instructor grades the submission', (select grade from public.assignment_submissions where user_id = :'S' and assignment_id = :'aA') = 80, (select r from p5));
create temp table p6 as select pg_temp.api(:'J', format('update public.assignment_submissions set grade = 1, score = 1 where user_id = %L and assignment_id = %L', :'S', :'aA')) as r;
select pg_temp.check('P6 another course''s instructor cannot grade it', (select grade from public.assignment_submissions where user_id = :'S' and assignment_id = :'aA') = 80, (select r from p6));
select pg_temp.check('P7 true-role reads: I sees the submission, J does not',
  pg_temp.api_count(:'I', format('select count(*) from public.assignment_submissions where user_id = %L and assignment_id = %L', :'S', :'aA')) = 1
  and pg_temp.api_count(:'J', format('select count(*) from public.assignment_submissions where user_id = %L and assignment_id = %L', :'S', :'aA')) = 0,
  'I=' || pg_temp.api_count(:'I', format('select count(*) from public.assignment_submissions where user_id = %L', :'S')) || ' J=' || pg_temp.api_count(:'J', format('select count(*) from public.assignment_submissions where user_id = %L', :'S')));
create temp table p8 as select pg_temp.api(:'S', format('update public.assignment_submissions set assignment_id = %L where user_id = %L and assignment_id = %L', :'aW', :'S', :'aA')) as r;
select pg_temp.check('P8 existing identity pin still holds (A->W retarget does not move the row)', pg_temp.nsub(:'S', :'aA') = 1 and pg_temp.nsub(:'S', :'aW') = 0, (select r from p8));
delete from public.content_item_progressions where user_id = :'S' and content_item_id = :'PD';
create temp table p9 as select pg_temp.api('00000000-0000-0000-0000-000000000000', format('insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (%L, %L, %L)', :'S', :'PD', 'read'), 'service_role') as r;
select pg_temp.check('P9 explicit maintenance: service_role may still write progress for any learner', pg_temp.nprog(:'S', :'PD') = 1, (select r from p9));
delete from public.content_item_progressions where user_id = :'S' and content_item_id = :'PD';
insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (:'S', :'PD', 'read');
select pg_temp.check('P10 explicit maintenance: a direct database session (no API claims) is unaffected', pg_temp.nprog(:'S', :'PD') = 1, '');
delete from public.certificates where user_id = :'S' and course_id = :'D'; delete from public.content_item_progressions where user_id = :'S' and content_item_id = :'PD';

-- ===== L. certificate issuer and legacy rows (no rewrite, no revocation) =====
-- Legacy rows from before the completion guard, inserted with triggers off to model history: EA and EQ marked done
-- with NO submission and NO finished attempt. No certificate exists yet for S2 in E.
set local session_replication_role = replica;
insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (:'S2', :'iEA', 'completed'), (:'S2', :'iEQ', 'completed');
-- Course F legacy row backed by a genuine submission (historical evidence that is real)
insert into public.assignment_submissions (assignment_id, user_id, submitted_at, body, workflow_state) values (:'aFA', :'S2', now() - interval '400 days', 'old work', 'submitted');
insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (:'S2', :'iFA', 'completed');
set local session_replication_role = origin;
create temp table l1 as select pg_temp.mark_as(:'S2', :'S2', :'EP', 'read') as r;
select pg_temp.check('L1 a genuine page completion does not turn legacy-invalid assessment rows into a NEW certificate', pg_temp.certs(:'S2', :'E') = 0, (select r from l1) || '; certs=' || pg_temp.certs(:'S2', :'E'));
create temp table l2 as select pg_temp.api(:'S2', format('update public.content_item_progressions set workflow_state = workflow_state where user_id = %L and content_item_id = %L', :'S2', :'iEA')) as r;
select pg_temp.check('L2 a no-op UPDATE of the legacy row issues no NEW certificate', pg_temp.certs(:'S2', :'E') = 0, (select r from l2) || '; certs=' || pg_temp.certs(:'S2', :'E'));
select pg_temp.check('L3 legacy rows are preserved, not rewritten', pg_temp.nprog(:'S2', :'iEA') = 1 and pg_temp.nprog(:'S2', :'iEQ') = 1
  and (select string_agg(workflow_state, ',' order by content_item_id) from public.content_item_progressions where user_id = :'S2' and content_item_id in (:'iEA', :'iEQ')) = 'completed,completed', '');
create temp table l4 as select pg_temp.mark_as(:'S2', :'S2', :'FP', 'read') as r;
select pg_temp.check('L4 legacy row with genuine historical evidence still completes the course (certificate issued)', pg_temp.certs(:'S2', :'F') = 1, (select r from l4) || '; certs=' || pg_temp.certs(:'S2', :'F'));
-- L5 an existing certificate is never touched (revocation is out of scope)
insert into public.certificates (user_id, course_id, certificate_type, certificate_data, verification_code, issued_at) values (:'S', :'E', 'completion', '{}'::jsonb, 'LEGACYCERT01', now() - interval '300 days');
select pg_temp.check('L5 an existing (historical) certificate is left as is', pg_temp.certs(:'S', :'E') = 1, '');

select (case when pass then 'PASS ' else 'FAIL ' end) || name || case when detail <> '' then '  [' || detail || ']' else '' end from results order by name;
select 'SUMMARY ' || count(*) filter (where pass) || '/' || count(*) || ' pass' from results;
do $$ declare n int; begin select count(*) into n from results where not pass; if n > 0 then raise exception '% check(s) FAILED', n; end if; end $$;
rollback;
