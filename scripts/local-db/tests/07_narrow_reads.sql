-- ABOUTME: Behavioural test of 20261102000000_narrow_quiz_feedback_blog_settings_reads on the LOCAL snapshot: who may
-- ABOUTME: read and insert career quiz attempts, read feedback, and read blog settings, as each real API role.
-- Tier: schema snapshot on PostgreSQL 16 with real RLS; actors act as anon/authenticated with PostgREST claims and a
-- request.headers value, the way PostgREST sets them. Not live, not PG15, not a browser. The static source check is
-- src/test/ci/narrowReadsMigration.test.ts; this file asserts behaviour. Without the migration, C3, C4, C9, C12, F1,
-- F2, F4, B3 and B4 fail by design (the old predicates were wider: every signed-in user read all feedback, so even
-- the owner sees all three rows in F1). Synthetic rows, one transaction, rolled back.
\set ON_ERROR_STOP on
begin;
\set U1    '71111111-1111-4111-8111-111111111111'
\set U2    '72222222-2222-4222-8222-222222222222'
\set ADM   '73333333-3333-4333-8333-333333333333'
\set INS   '74444444-4444-4444-8444-444444444444'
\set c1    '7c000000-0000-4000-8000-000000000001'
\set c2    '7c000000-0000-4000-8000-000000000002'
\set c3    '7c000000-0000-4000-8000-000000000003'
\set f1    '7f000000-0000-4000-8000-000000000001'
\set f2    '7f000000-0000-4000-8000-000000000002'
\set f3    '7f000000-0000-4000-8000-000000000003'
\set bs    '7b000000-0000-4000-8000-000000000001'
insert into auth.users (id, email) values (:'U1','n-u1@local.test'), (:'U2','n-u2@local.test'), (:'ADM','n-adm@local.test'), (:'INS','n-ins@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'U1', :'U2', :'ADM', :'INS') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'U1','student'), (:'U2','student'), (:'ADM','admin'), (:'INS','instructor') on conflict do nothing;
-- fixtures written as postgres (no claims): one signed-in attempt carrying a session id, two anonymous attempts
insert into public.career_quiz_attempts (id, user_id, session_id, top_recommended_path) values
  (:'c1', :'U1', 'sess-u1', 'synthetic'), (:'c2', null, 'sess-anon-1', 'synthetic'), (:'c3', null, 'sess-anon-2', 'synthetic');
insert into public.user_feedback (id, page_path, is_useful, user_id) values
  (:'f1', '/synthetic', true, :'U1'), (:'f2', '/synthetic', false, :'U2'), (:'f3', '/synthetic', true, null);
insert into public.blog_settings (id, notification_email) values (:'bs', 'synthetic@local.test');

create temp table results (name text, pass boolean, detail text); grant all on results to public;
-- act as an API caller: p_uid null means anon; p_session null means no session-id header (headers still set, as PostgREST does)
create or replace function pg_temp.as_api(p_uid uuid, p_session text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', 'anon')::text
                                                else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers', case when p_session is null then '{}' else json_build_object('session-id', p_session)::text end, true);
  perform set_config('role', case when p_uid is null then 'anon' else 'authenticated' end, true);
end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); perform set_config('request.headers', '', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text) returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), coalesce(p_detail, '')); end $$;
create or replace function pg_temp.api_count(p_uid uuid, p_session text, p_sql text) returns int language plpgsql as $$
declare n int; begin perform pg_temp.as_api(p_uid, p_session);
  begin execute p_sql into n; exception when insufficient_privilege then n := 0; end;
  perform pg_temp.as_postgres(); return n; end $$;
create or replace function pg_temp.api(p_uid uuid, p_session text, p_sql text) returns text language plpgsql as $$
declare r text; n int;
begin perform pg_temp.as_api(p_uid, p_session);
  begin execute p_sql; get diagnostics n = row_count; r := 'accepted (' || n || ' rows)'; exception when others then r := 'REFUSED: ' || sqlerrm; end;
  perform pg_temp.as_postgres(); return r; end $$;
create or replace function pg_temp.sees(p_uid uuid, p_session text, p_table text, p_id uuid) returns int language sql as $$
  select pg_temp.api_count(p_uid, p_session, format('select count(*)::int from public.%I where id = %L', p_table, p_id)) $$;
create or replace function pg_temp.attempts(p_marker text) returns int language sql as $$
  select count(*)::int from public.career_quiz_attempts where top_recommended_path = p_marker $$;

-- ===== C. career_quiz_attempts: signed-in rows by owner only; the session-id branch reaches anonymous rows only =====
select pg_temp.check('C1 the owner reads their own signed-in attempt', pg_temp.sees(:'U1', null, 'career_quiz_attempts', :'c1') = 1, '');
select pg_temp.check('C2 another signed-in user cannot read it', pg_temp.sees(:'U2', null, 'career_quiz_attempts', :'c1') = 0, '');
select pg_temp.check('C3 anon presenting the owner''s session id cannot read the signed-in attempt', pg_temp.sees(null, 'sess-u1', 'career_quiz_attempts', :'c1') = 0, '');
select pg_temp.check('C4 another signed-in user presenting the owner''s session id cannot read it', pg_temp.sees(:'U2', 'sess-u1', 'career_quiz_attempts', :'c1') = 0, '');
select pg_temp.check('C5 compatibility: anon with a matching session id reads its own anonymous attempt', pg_temp.sees(null, 'sess-anon-1', 'career_quiz_attempts', :'c2') = 1, '');
select pg_temp.check('C6 anon cannot read another anonymous session''s attempt', pg_temp.sees(null, 'sess-anon-1', 'career_quiz_attempts', :'c3') = 0, '');
select pg_temp.check('C7 anon with no session id reads none of the three',
  pg_temp.api_count(null, null, format('select count(*)::int from public.career_quiz_attempts where id in (%L, %L, %L)', :'c1', :'c2', :'c3')) = 0, '');
create temp table c8 as select pg_temp.api(null, 'sess-anon-9', format('insert into public.career_quiz_attempts (user_id, session_id, top_recommended_path) values (null, %L, %L)', 'sess-anon-9', 'c8')) as r;
select pg_temp.check('C8 compatibility: anon inserts an anonymous attempt under its own session id', pg_temp.attempts('c8') = 1, (select r from c8));
create temp table c9 as select pg_temp.api(null, 'sess-u1', format('insert into public.career_quiz_attempts (user_id, session_id, top_recommended_path) values (%L, %L, %L)', :'U1', 'sess-u1', 'c9')) as r;
select pg_temp.check('C9 anon cannot insert an attempt owned by a signed-in user, even with that user''s session id', pg_temp.attempts('c9') = 0, (select r from c9));
create temp table c10 as select pg_temp.api(:'U2', null, format('insert into public.career_quiz_attempts (user_id, session_id, top_recommended_path) values (%L, null, %L)', :'U1', 'c10')) as r;
select pg_temp.check('C10 a signed-in user cannot insert an attempt for another user', pg_temp.attempts('c10') = 0, (select r from c10));
create temp table c11 as select pg_temp.api(:'U1', 'sess-u1', format('insert into public.career_quiz_attempts (user_id, session_id, top_recommended_path) values (%L, %L, %L)', :'U1', 'sess-u1', 'c11')) as r;
select pg_temp.check('C11 control: a signed-in user inserts their own attempt', pg_temp.attempts('c11') = 1, (select r from c11));
create temp table c12 as select pg_temp.api(:'U2', 'sess-u1', format('insert into public.career_quiz_attempts (user_id, session_id, top_recommended_path) values (%L, %L, %L)', :'U1', 'sess-u1', 'c12')) as r;
select pg_temp.check('C12 a signed-in user presenting another user''s session id cannot insert that user''s attempt', pg_temp.attempts('c12') = 0, (select r from c12));

-- ===== F. user_feedback SELECT: the row's owner or an admin; INSERT unchanged =====
create or replace function pg_temp.fb(p_uid uuid) returns text language sql as $$
  select coalesce(pg_temp.api_count(p_uid, null, format('select count(*)::int from public.user_feedback where id = %L', '7f000000-0000-4000-8000-000000000001'))::text, '?')
      || pg_temp.api_count(p_uid, null, format('select count(*)::int from public.user_feedback where id = %L', '7f000000-0000-4000-8000-000000000002'))::text
      || pg_temp.api_count(p_uid, null, format('select count(*)::int from public.user_feedback where id = %L', '7f000000-0000-4000-8000-000000000003'))::text $$;
select pg_temp.check('F1 the owner reads only their own feedback (f1)', pg_temp.fb(:'U1') = '100', 'visible f1f2f3=' || pg_temp.fb(:'U1'));
select pg_temp.check('F2 another user reads only their own (f2), not f1 or the anonymous f3', pg_temp.fb(:'U2') = '010', 'visible f1f2f3=' || pg_temp.fb(:'U2'));
select pg_temp.check('F3 an admin reads all three', pg_temp.fb(:'ADM') = '111', 'visible f1f2f3=' || pg_temp.fb(:'ADM'));
select pg_temp.check('F4 a non-admin instructor reads none of them', pg_temp.fb(:'INS') = '000', 'visible f1f2f3=' || pg_temp.fb(:'INS'));
select pg_temp.check('F5 anon reads none of them', pg_temp.fb(null) = '000', 'visible f1f2f3=' || pg_temp.fb(null));
create temp table f6 as select pg_temp.api(:'U1', null, format('insert into public.user_feedback (page_path, is_useful, user_id, feedback_text) values (%L, true, %L, %L)', '/synthetic', :'U1', 'f6')) as r;
select pg_temp.check('F6 control: the insert path is unchanged (a user still submits their own feedback)',
  (select count(*) from public.user_feedback where feedback_text = 'f6' and user_id = :'U1') = 1, (select r from f6));

-- ===== B. blog_settings SELECT: admins and instructors (full row); not students, not anon; admin writes unchanged =====
select pg_temp.check('B1 an admin reads the settings row', pg_temp.sees(:'ADM', null, 'blog_settings', :'bs') = 1, '');
select pg_temp.check('B2 an instructor reads the full row, notification_email included (authoring path kept)',
  pg_temp.api_count(:'INS', null, format('select count(*)::int from public.blog_settings where id = %L and notification_email = %L', :'bs', 'synthetic@local.test')) = 1, '');
select pg_temp.check('B3 a student cannot read it', pg_temp.sees(:'U1', null, 'blog_settings', :'bs') = 0, '');
select pg_temp.check('B4 anon cannot read it', pg_temp.sees(null, null, 'blog_settings', :'bs') = 0, '');
create temp table b5 as select pg_temp.api(:'INS', null, format('update public.blog_settings set notification_email = %L where id = %L', 'changed@local.test', :'bs')) as r;
select pg_temp.check('B5 control: reading does not grant writing (an instructor update changes nothing)',
  (select notification_email from public.blog_settings where id = :'bs') = 'synthetic@local.test', (select r from b5));

select (case when pass then 'PASS ' else 'FAIL ' end) || name || case when detail <> '' then '  [' || detail || ']' else '' end from results order by name;
select 'SUMMARY ' || count(*) filter (where pass) || '/' || count(*) || ' pass' from results;
do $$ declare n int; begin select count(*) into n from results where not pass; if n > 0 then raise exception '% check(s) FAILED', n; end if; end $$;
rollback;
