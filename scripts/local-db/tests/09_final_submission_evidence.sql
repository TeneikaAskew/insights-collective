-- ABOUTME: T-09 r5 on the LOCAL snapshot: only a FINAL submission (submitted with a timestamp, or graded) is evidence
-- ABOUTME: that an assignment is done, for the completion guard and the certificate issuer alike.
-- Tier: schema snapshot on PostgreSQL 16, real triggers and RLS, real API roles. Not live, not PG15, not a browser.
-- Course G (owner I) is ASSIGNMENT-ONLY besides one page, so no quiz can mask an assignment case: page GP,
-- assignment GA, hidden (unpublished) assignment item GH. S3, S4, S5, S6 are 'student' only and enrolled in G only.
-- Certificates are reset (as maintenance) between cases so each certificate check is independent. Synthetic rows,
-- one transaction, rolled back. Any FAIL makes psql exit non-zero.
\set ON_ERROR_STOP on
begin;
\set I   '61111111-1111-4111-8111-111111111111'
\set S3  '65555555-5555-4555-8555-555555555555'
\set S4  '66666666-6666-4666-8666-666666666666'
\set S5  '67777777-7777-4777-8777-777777777777'
\set S6  '68888888-8888-4888-8888-888888888888'
\set G   'f0000000-0000-4000-8000-000000000a00'
\set GM  'f0000000-0000-4000-8000-000000000a0a'
\set GP  'f0000000-0000-4000-8000-000000000a01'
\set iGA 'f0000000-0000-4000-8000-000000000a02'
\set iGH 'f0000000-0000-4000-8000-000000000a03'
\set aGA 'f0000000-0000-4000-8000-000000001a02'
insert into auth.users (id, email) values (:'I','r5-i@local.test'), (:'S3','r5-s3@local.test'), (:'S4','r5-s4@local.test'), (:'S5','r5-s5@local.test'), (:'S6','r5-s6@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'I', :'S3', :'S4', :'S5', :'S6') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'I','instructor'), (:'S3','student'), (:'S4','student'), (:'S5','student'), (:'S6','student') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values (:'G','Course G','s','General','beginner', :'I', true);
insert into public.modules (id, course_id, title, position, published) values (:'GM', :'G', 'MG', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (:'GP', :'G', :'GM', 'page', 'GP', 1, true),
  (:'iGA', :'G', :'GM', 'assignment', 'GA', 2, true),
  (:'iGH', :'G', :'GM', 'page', 'GH hidden', 3, false);
insert into public.assignments (id, content_item_id, course_id, title) values (:'aGA', :'iGA', :'G', 'GA');
insert into public.enrollments (user_id, course_id) values (:'S3', :'G'), (:'S4', :'G'), (:'S5', :'G'), (:'S6', :'G');

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
create or replace function pg_temp.sub_as(p_uid uuid, p_state text, p_ts boolean) returns text language sql as $$
  select pg_temp.api(p_uid, format('insert into public.assignment_submissions (assignment_id, user_id, submitted_at, submission_type, body, workflow_state) values (%L, %L, %s, %L, %L, %L)',
    'f0000000-0000-4000-8000-000000001a02', p_uid, case when p_ts then 'now()' else 'null' end, 'online_text_entry', 'body', p_state)) $$;
create or replace function pg_temp.mark_as(p_uid uuid, p_item uuid, p_state text) returns text language sql as $$
  select pg_temp.api(p_uid, format('insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (%L, %L, %L) on conflict (user_id, content_item_id) do update set workflow_state = excluded.workflow_state', p_uid, p_item, p_state)) $$;
create or replace function pg_temp.done(p_uid uuid, p_item uuid) returns boolean language sql as $$
  select exists (select 1 from public.content_item_progressions where user_id = p_uid and content_item_id = p_item and workflow_state in ('read','completed','graded')) $$;
create or replace function pg_temp.certs(p_uid uuid) returns int language sql as $$ select count(*)::int from public.certificates where user_id = p_uid and course_id = 'f0000000-0000-4000-8000-000000000a00' $$;
create or replace function pg_temp.state(p_uid uuid) returns text language sql as $$ select coalesce(string_agg(coalesce(workflow_state,'NULL'), ','), 'none') from public.assignment_submissions where user_id = p_uid and assignment_id = 'f0000000-0000-4000-8000-000000001a02' $$;
-- maintenance reset between cases (postgres, no claims): learner's submissions, progress and certificates in G
create or replace function pg_temp.reset(p_uid uuid) returns void language sql as $$
  delete from public.certificates where user_id = p_uid and course_id = 'f0000000-0000-4000-8000-000000000a00';
  delete from public.content_item_progressions where user_id = p_uid;
  delete from public.assignment_submissions where user_id = p_uid; $$;

select pg_temp.check('PRE S3..S6 are student only and enrolled in G only; G has no quiz',
  (select count(*) from public.user_roles where user_id in (:'S3',:'S4',:'S5',:'S6') and role::text <> 'student') = 0
  and (select count(*) from public.enrollments where user_id in (:'S3',:'S4',:'S5',:'S6') and course_id <> :'G') = 0
  and (select count(*) from public.content_items where course_id = :'G' and type::text = 'quiz') = 0, '');

-- ===== N. non-final submissions are not evidence (guard refuses; no certificate) =====
create or replace function pg_temp.nonfinal_case(p_state text) returns text language plpgsql as $$
declare s text; m text; g text;
begin perform pg_temp.reset('65555555-5555-4555-8555-555555555555');
  s := pg_temp.sub_as('65555555-5555-4555-8555-555555555555', p_state, true);
  g := pg_temp.mark_as('65555555-5555-4555-8555-555555555555', 'f0000000-0000-4000-8000-000000000a01', 'read');
  m := pg_temp.mark_as('65555555-5555-4555-8555-555555555555', 'f0000000-0000-4000-8000-000000000a02', 'completed');
  return 'submit: ' || s || '; complete GA: ' || m || '; done=' || pg_temp.done('65555555-5555-4555-8555-555555555555', 'f0000000-0000-4000-8000-000000000a02')
    || '; certs=' || pg_temp.certs('65555555-5555-4555-8555-555555555555'); end $$;
create temp table n1 as select pg_temp.nonfinal_case('unsubmitted') as r;
select pg_temp.check('N1 timestamped UNSUBMITTED (staged) submission does not complete GA or issue a certificate', not pg_temp.done(:'S3', :'iGA') and pg_temp.certs(:'S3') = 0, (select r from n1));
create temp table n2 as select pg_temp.nonfinal_case('draft') as r;
select pg_temp.check('N2 timestamped DRAFT submission does not complete GA or issue a certificate', not pg_temp.done(:'S3', :'iGA') and pg_temp.certs(:'S3') = 0, (select r from n2));
create temp table n3 as select pg_temp.nonfinal_case('pending_review') as r;
select pg_temp.check('N3 timestamped submission in any other non-final state does not count', not pg_temp.done(:'S3', :'iGA') and pg_temp.certs(:'S3') = 0, (select r from n3));
create temp table n4 as select pg_temp.nonfinal_case(null) as r;
select pg_temp.check('N4 timestamped submission with NULL state does not count', not pg_temp.done(:'S3', :'iGA') and pg_temp.certs(:'S3') = 0, (select r from n4));
-- N5 the learner cannot forge 'graded' on their own staged submission
select pg_temp.reset(:'S3');
select pg_temp.sub_as(:'S3', 'unsubmitted', true);
create temp table n5 as select pg_temp.api(:'S3', format('update public.assignment_submissions set workflow_state = %L where user_id = %L and assignment_id = %L', 'graded', :'S3', :'aGA')) as r;
create temp table n5b as select pg_temp.mark_as(:'S3', :'iGA', 'completed') as r;
select pg_temp.check('N5 a learner cannot set their own submission to graded, so it cannot complete GA', pg_temp.state(:'S3') <> 'graded' and not pg_temp.done(:'S3', :'iGA'),
  (select r from n5) || '; state=' || pg_temp.state(:'S3') || '; complete GA: ' || (select r from n5b));
-- N6 missing evidence
select pg_temp.reset(:'S3');
create temp table n6 as select pg_temp.mark_as(:'S3', :'iGA', 'completed') as r;
select pg_temp.check('N6 no submission at all: GA cannot be completed', not pg_temp.done(:'S3', :'iGA'), (select r from n6));

-- ===== R. state reversion after a genuine completion =====
select pg_temp.reset(:'S3');
create temp table r1 as select pg_temp.sub_as(:'S3', 'submitted', true) || ' / ' || pg_temp.mark_as(:'S3', :'iGA', 'completed') || ' / ' || pg_temp.mark_as(:'S3', :'GP', 'read') as r;
select pg_temp.check('R1 positive: genuine submitted submission completes GA and issues one certificate', pg_temp.done(:'S3', :'iGA') and pg_temp.certs(:'S3') = 1, (select r from r1) || '; certs=' || pg_temp.certs(:'S3'));
delete from public.certificates where user_id = :'S3' and course_id = :'G';   -- reset (maintenance) so R2 is independent
create temp table r2 as select pg_temp.api(:'S3', format('update public.assignment_submissions set workflow_state = %L where user_id = %L and assignment_id = %L', 'unsubmitted', :'S3', :'aGA')) as r;
create temp table r2b as select pg_temp.api(:'S3', format('update public.content_item_progressions set workflow_state = workflow_state where user_id = %L and content_item_id = %L', :'S3', :'iGA')) as r;
select pg_temp.check('R2 after the learner reverts the submission to unsubmitted, a no-op UPDATE of the done row issues no NEW certificate', pg_temp.certs(:'S3') = 0,
  'revert: ' || (select r from r2) || '; state=' || pg_temp.state(:'S3') || '; no-op: ' || (select r from r2b) || '; certs=' || pg_temp.certs(:'S3'));
create temp table r3 as select pg_temp.mark_as(:'S3', :'GP', 'completed') as r;
select pg_temp.check('R3 ... and a later genuine page completion issues no NEW certificate either', pg_temp.certs(:'S3') = 0, (select r from r3) || '; certs=' || pg_temp.certs(:'S3'));
select pg_temp.check('R4 the reverted learner''s done row is preserved (no history rewrite)', pg_temp.done(:'S3', :'iGA'), '');

-- ===== P. preserved positives and staff/maintenance =====
create temp table p1 as select pg_temp.sub_as(:'S4', 'submitted', true) as r;
create temp table p1b as select pg_temp.api(:'I', format('update public.assignment_submissions set workflow_state = %L, score = 0, grade = %L, graded_at = now() where user_id = %L and assignment_id = %L', 'graded', '0', :'S4', :'aGA')) as r;
create temp table p1c as select pg_temp.mark_as(:'S4', :'iGA', 'completed') || ' / ' || pg_temp.mark_as(:'S4', :'GP', 'read') as r;
select pg_temp.check('P1 staff-graded submission with score 0 is final evidence: GA completes, one certificate', pg_temp.state(:'S4') = 'graded' and pg_temp.done(:'S4', :'iGA') and pg_temp.certs(:'S4') = 1,
  'grade: ' || (select r from p1b) || '; ' || (select r from p1c) || '; certs=' || pg_temp.certs(:'S4'));
select pg_temp.check('P2 course instructor grading still works (state graded, score 0 kept)', (select score from public.assignment_submissions where user_id = :'S4' and assignment_id = :'aGA') = 0, (select r from p1b));
select pg_temp.reset(:'S6');
select pg_temp.sub_as(:'S6', 'unsubmitted', true);
create temp table p3 as select pg_temp.api(:'S6', format('update public.assignment_submissions set workflow_state = %L, submitted_at = now(), body = %L where user_id = %L and assignment_id = %L', 'submitted', 'final', :'S6', :'aGA')) as r;
create temp table p3b as select pg_temp.mark_as(:'S6', :'iGA', 'completed') as r;
select pg_temp.check('P3 a learner finalising their own staged submission (unsubmitted -> submitted) can then complete GA', pg_temp.state(:'S6') = 'submitted' and pg_temp.done(:'S6', :'iGA'),
  (select r from p3) || '; ' || (select r from p3b));
create temp table p4 as select pg_temp.api(:'S6', format('update public.assignment_submissions set workflow_state = %L where user_id = %L and assignment_id = %L', 'graded', :'S6', :'aGA'), 'service_role') as r;
select pg_temp.check('P4 service_role maintenance can still set graded', pg_temp.state(:'S6') = 'graded', (select r from p4));

-- ===== L. legacy rows (written below the API, as historical data) =====
set local session_replication_role = replica;
insert into public.assignment_submissions (assignment_id, user_id, submitted_at, submission_type, body, workflow_state) values (:'aGA', :'S5', now() - interval '200 days', 'online_text_entry', 'legacy staged', 'unsubmitted');
insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (:'S5', :'iGA', 'completed');
set local session_replication_role = origin;
create temp table l1 as select pg_temp.mark_as(:'S5', :'GP', 'read') as r;
select pg_temp.check('L1 legacy done row backed only by a timestamped unsubmitted submission: a page completion issues no NEW certificate', pg_temp.certs(:'S5') = 0, (select r from l1) || '; certs=' || pg_temp.certs(:'S5'));
create temp table l2 as select pg_temp.api(:'S5', format('update public.content_item_progressions set workflow_state = workflow_state where user_id = %L and content_item_id = %L', :'S5', :'iGA')) as r;
select pg_temp.check('L2 ... nor does a no-op UPDATE of the legacy done row', pg_temp.certs(:'S5') = 0, (select r from l2) || '; certs=' || pg_temp.certs(:'S5'));
select pg_temp.check('L3 the legacy rows are preserved', pg_temp.done(:'S5', :'iGA') and pg_temp.state(:'S5') = 'unsubmitted', '');
insert into public.certificates (user_id, course_id, certificate_type, certificate_data, verification_code, issued_at) values (:'S5', :'G', 'completion', '{}'::jsonb, 'LEGACYCERTG1', now() - interval '100 days') on conflict do nothing;
select pg_temp.check('L4 an existing certificate is left as is', pg_temp.certs(:'S5') = 1, '');

-- ===== T. OLD target of an UPDATE: the restrictive update policies check the NEW row; test the OLD side =====
select pg_temp.reset(:'S6');
insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values (:'S6', :'iGH', 'read');  -- row on a hidden item (written as maintenance)
create temp table t1 as select pg_temp.api(:'S6', format('update public.content_item_progressions set workflow_state = %L where user_id = %L and content_item_id = %L', 'completed', :'S6', :'iGH')) as r;
select pg_temp.check('T1 a learner cannot change their own progress row on a hidden item (OLD and NEW target hidden)',
  (select workflow_state from public.content_item_progressions where user_id = :'S6' and content_item_id = :'iGH') = 'read', (select r from t1));
create temp table t2 as select pg_temp.api(:'S6', format('update public.content_item_progressions set content_item_id = %L where user_id = %L and content_item_id = %L', :'GP', :'S6', :'iGH')) as r;
select pg_temp.check('T2 a learner cannot move their progress row FROM a hidden item to a visible one (OLD target hidden, NEW visible)',
  (select count(*) from public.content_item_progressions where user_id = :'S6' and content_item_id = :'GP') = 0
  and (select count(*) from public.content_item_progressions where user_id = :'S6' and content_item_id = :'iGH') = 1, (select r from t2));

select (case when pass then 'PASS ' else 'FAIL ' end) || name || case when detail <> '' then '  [' || detail || ']' else '' end from results order by name;
select 'SUMMARY ' || count(*) filter (where pass) || '/' || count(*) || ' pass' from results;
do $$ declare n int; begin select count(*) into n from results where not pass; if n > 0 then raise exception '% check(s) FAILED', n; end if; end $$;
rollback;
