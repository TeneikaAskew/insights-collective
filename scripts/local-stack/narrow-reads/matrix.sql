-- ABOUTME: #159 narrow-reads role matrix on the LOCAL disposable snapshot stack: career_quiz_attempts, user_feedback and
-- ABOUTME: blog_settings, for anon, two students, an instructor and an admin, with and without a session-id header.
-- Fixture model: this matrix is TRANSACTION-ROLLED-BACK. Its actors and rows use the c159... ids, exist only inside this
-- transaction, and every count is restricted to those ids, so the committed baseline (baseline.sql,
-- b159... ids, used only for the preservation row hash) never changes a result here. Every write is undone by its own
-- subtransaction. Runners refuse non-loopback.
--
-- Contract (r2). The SQL is identical before and after the migration; only the database's policies differ. Every case
-- carries its literal OLD (snapshot) and NEW (#159) expectation, and is judged against BOTH:
--   PASS/FAIL  = observed equals the NEW expectation        old=MATCH/DIFF = observed equals the OLD expectation
-- "closed" means OLD and NEW differ (checked per case: a mismatch is an infrastructure error, never a result).
-- So on the snapshot policies: every closed case is "FAIL <id> closed old=MATCH" and every kept case "PASS <id> kept old=MATCH",
-- and the closing assertion counts the 8 closed cases. On the #159 policies: every case PASSes, closed ones with old=DIFF.
-- There is no mode variable: the driver (tier.sh) decides which of the two outcomes the stage requires.
-- Output (stdout, fixed grammar only): "<PASS|FAIL> <id> <closed|kept> old=<MATCH|DIFF>" per case, then
-- "CHECKS <n> closed <m>"; closing assertion (stderr) "<n> narrow-read check(s) failed". No observed values are printed.
\set ON_ERROR_STOP on
begin;

\set uA 'c1590000-0000-4000-8000-00000000000a'
\set uB 'c1590000-0000-4000-8000-00000000000b'
\set uI 'c1590000-0000-4000-8000-00000000000c'
\set uM 'c1590000-0000-4000-8000-00000000000d'
insert into auth.users (id, email) values
  (:'uA', 'nr-student-a@local.test'), (:'uB', 'nr-student-b@local.test'),
  (:'uI', 'nr-instructor@local.test'), (:'uM', 'nr-admin@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'uA', :'uB', :'uI', :'uM') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values
  (:'uA', 'student'), (:'uB', 'student'), (:'uI', 'instructor'), (:'uM', 'admin') on conflict do nothing;

-- career_quiz_attempts: QA (A, session SA), QB (B, SB), QX (anonymous, SX)
insert into public.career_quiz_attempts (id, user_id, session_id) values
  ('c1590000-0000-4000-8000-0000000000a1', :'uA', 'nr-sess-a'),
  ('c1590000-0000-4000-8000-0000000000b1', :'uB', 'nr-sess-b'),
  ('c1590000-0000-4000-8000-0000000000f1', null,  'nr-sess-x');
-- user_feedback: FA (A), FB (B), FN (no user)
insert into public.user_feedback (id, page_path, is_useful, user_id) values
  ('c1590000-0000-4000-8000-0000000000a2', '/nr', true, :'uA'),
  ('c1590000-0000-4000-8000-0000000000b2', '/nr', true, :'uB'),
  ('c1590000-0000-4000-8000-0000000000f2', '/nr', false, null);
-- blog_settings: one row with a non-empty notification_email
insert into public.blog_settings (id, notification_email) values ('c1590000-0000-4000-8000-0000000000e3', 'nr-notify@local.test');

create temp table results (id text primary key, kind text not null, pass boolean not null, old_match boolean not null);
-- The request.headers GUC is ALWAYS set ('{}' = no header): an unset GUC raises, which must be INVALID, never a pass.
create or replace function pg_temp.as_user(p_uid uuid, p_role text, p_headers text) returns void language plpgsql as $$
begin
  perform set_config('request.headers', p_headers, true);
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', p_role)::text else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
end $$;
create or replace function pg_temp.as_super() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); perform set_config('request.headers', '{}', true); end $$;
-- One case's id and kind must agree with its own literals; anything else is a broken matrix (an ERROR, so INVALID).
create or replace function pg_temp.case_ok(p_id text, p_kind text, p_old text, p_new text) returns void language plpgsql as $$
begin
  if p_id !~ '^[QFB][0-9]{2}$' or p_kind not in ('closed', 'kept') or (p_kind = 'closed') <> (p_old is distinct from p_new) then
    raise exception 'narrow-read matrix case % is malformed', p_id;
  end if;
end $$;
create or replace function pg_temp.record(p_id text, p_kind text, p_got text, p_old text, p_new text) returns void language sql as $$
  insert into results values (p_id, p_kind, p_got = p_new, p_got = p_old) $$;

-- Visible rows, as the sorted list of their fixed tags, restricted to this matrix's own ids.
create or replace function pg_temp.check_rows(p_id text, p_kind text, p_uid uuid, p_role text, p_headers text, p_table text, p_old text, p_new text) returns void language plpgsql as $$
declare got text;
begin
  perform pg_temp.case_ok(p_id, p_kind, p_old, p_new);
  perform pg_temp.as_user(p_uid, p_role, p_headers);
  begin
    execute format($q$select coalesce(string_agg(case right(id::text, 2) when 'a1' then 'QA' when 'b1' then 'QB' when 'f1' then 'QX'
      when 'a2' then 'FA' when 'b2' then 'FB' when 'f2' then 'FN' when 'e3' then 'BS' end, ',' order by id::text), '-')
      from public.%I where id::text like 'c1590000-0000-4000-8000-%%'$q$, p_table) into got;
  exception when insufficient_privilege then got := '-';
  end;
  perform pg_temp.as_super();
  perform pg_temp.record(p_id, p_kind, got, p_old, p_new);
end $$;

-- A write: 'allowed' or 'denied' (42501), or a row count for a statement that returns one. Any other error propagates:
-- infrastructure, never behaviour. The write is always undone by raising a private SQLSTATE inside its own block.
create or replace function pg_temp.check_write(p_id text, p_kind text, p_uid uuid, p_role text, p_headers text, p_sql text, p_old text, p_new text) returns void language plpgsql as $$
declare got text; n int;
begin
  perform pg_temp.case_ok(p_id, p_kind, p_old, p_new);
  perform pg_temp.as_user(p_uid, p_role, p_headers);
  begin
    -- EXECUTE ... INTO is only valid for a statement that returns rows; a bare INSERT runs without it.
    if p_sql ~* '^\s*(select|with)\M' then execute p_sql into n; got := n::text || ' row(s)';
    else execute p_sql; got := 'allowed';
    end if;
    raise exception using errcode = 'ZX159', message = 'undo';
  exception
    when sqlstate 'ZX159' then null;
    when insufficient_privilege then got := 'denied';
  end;
  perform pg_temp.as_super();
  perform pg_temp.record(p_id, p_kind, got, p_old, p_new);
end $$;

-- career_quiz_attempts SELECT
-- Q01 kept: quiz anon header SX sees the anonymous row
select pg_temp.check_rows('Q01', 'kept', null, 'anon', '{"session-id":"nr-sess-x"}', 'career_quiz_attempts', 'QX', 'QX');
-- Q02 closed: quiz anon header SA (a signed-in user's session id) sees nothing
select pg_temp.check_rows('Q02', 'closed', null, 'anon', '{"session-id":"nr-sess-a"}', 'career_quiz_attempts', 'QA', '-');
-- Q03 kept: quiz anon no header sees nothing
select pg_temp.check_rows('Q03', 'kept', null, 'anon', '{}', 'career_quiz_attempts', '-', '-');
-- Q04 kept: quiz A no header sees own row
select pg_temp.check_rows('Q04', 'kept', :'uA', 'authenticated', '{}', 'career_quiz_attempts', 'QA', 'QA');
-- Q05 closed: quiz A header SB sees only own row
select pg_temp.check_rows('Q05', 'closed', :'uA', 'authenticated', '{"session-id":"nr-sess-b"}', 'career_quiz_attempts', 'QA,QB', 'QA');
-- Q06 kept: quiz A header SX sees own and the anonymous row
select pg_temp.check_rows('Q06', 'kept', :'uA', 'authenticated', '{"session-id":"nr-sess-x"}', 'career_quiz_attempts', 'QA,QX', 'QA,QX');
-- career_quiz_attempts INSERT
-- Q07 kept: quiz anon header SX inserts an anonymous row
select pg_temp.check_write('Q07', 'kept', null, 'anon', '{"session-id":"nr-sess-x"}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values (null, 'nr-sess-x')$$, 'allowed', 'allowed');
-- Q08 closed: quiz anon header SA cannot insert as user A
select pg_temp.check_write('Q08', 'closed', null, 'anon', '{"session-id":"nr-sess-a"}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values ('c1590000-0000-4000-8000-00000000000a', 'nr-sess-a')$$, 'allowed', 'denied');
-- Q09 kept: quiz A inserts own row
select pg_temp.check_write('Q09', 'kept', :'uA', 'authenticated', '{}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values ('c1590000-0000-4000-8000-00000000000a', 'nr-sess-a2')$$, 'allowed', 'allowed');
-- Q10 closed: quiz A header SB cannot insert as user B
select pg_temp.check_write('Q10', 'closed', :'uA', 'authenticated', '{"session-id":"nr-sess-b"}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values ('c1590000-0000-4000-8000-00000000000b', 'nr-sess-b')$$, 'allowed', 'denied');
-- Q11 kept: quiz A no header cannot insert as user B
select pg_temp.check_write('Q11', 'kept', :'uA', 'authenticated', '{}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values ('c1590000-0000-4000-8000-00000000000b', 'nr-sess-b')$$, 'denied', 'denied');

-- user_feedback
-- F01 kept: feedback anon sees nothing
select pg_temp.check_rows('F01', 'kept', null, 'anon', '{}', 'user_feedback', '-', '-');
-- F02 closed: feedback A sees only own row
select pg_temp.check_rows('F02', 'closed', :'uA', 'authenticated', '{}', 'user_feedback', 'FA,FB,FN', 'FA');
-- F03 closed: feedback instructor sees nothing of others
select pg_temp.check_rows('F03', 'closed', :'uI', 'authenticated', '{}', 'user_feedback', 'FA,FB,FN', '-');
-- F04 kept: feedback admin sees all
select pg_temp.check_rows('F04', 'kept', :'uM', 'authenticated', '{}', 'user_feedback', 'FA,FB,FN', 'FA,FB,FN');
-- F05 kept: feedback A inserts own row
select pg_temp.check_write('F05', 'kept', :'uA', 'authenticated', '{}',
  $$insert into public.user_feedback (page_path, is_useful, user_id) values ('/nr', true, 'c1590000-0000-4000-8000-00000000000a')$$, 'allowed', 'allowed');
-- F06 kept: feedback A inserts a no-user row
select pg_temp.check_write('F06', 'kept', :'uA', 'authenticated', '{}',
  $$insert into public.user_feedback (page_path, is_useful, user_id) values ('/nr', true, null)$$, 'allowed', 'allowed');
-- F07 kept: feedback A updates own row
select pg_temp.check_write('F07', 'kept', :'uA', 'authenticated', '{}',
  $$with u as (update public.user_feedback set feedback_text = 'nr' where id = 'c1590000-0000-4000-8000-0000000000a2' returning 1) select count(*) from u$$, '1 row(s)', '1 row(s)');
-- F08 kept: feedback A cannot update B's row
select pg_temp.check_write('F08', 'kept', :'uA', 'authenticated', '{}',
  $$with u as (update public.user_feedback set feedback_text = 'nr' where id = 'c1590000-0000-4000-8000-0000000000b2' returning 1) select count(*) from u$$, '0 row(s)', '0 row(s)');

-- blog_settings
-- B01 closed: blog anon sees nothing
select pg_temp.check_rows('B01', 'closed', null, 'anon', '{}', 'blog_settings', 'BS', '-');
-- B02 closed: blog student sees nothing
select pg_temp.check_rows('B02', 'closed', :'uA', 'authenticated', '{}', 'blog_settings', 'BS', '-');
-- B03 kept: blog instructor sees the row
select pg_temp.check_rows('B03', 'kept', :'uI', 'authenticated', '{}', 'blog_settings', 'BS', 'BS');
-- B04 kept: blog admin sees the row
select pg_temp.check_rows('B04', 'kept', :'uM', 'authenticated', '{}', 'blog_settings', 'BS', 'BS');
-- B05 kept: blog instructor reads the FULL row incl. notification_email
select pg_temp.check_write('B05', 'kept', :'uI', 'authenticated', '{}',
  $$select count(*) from public.blog_settings where id = 'c1590000-0000-4000-8000-0000000000e3' and notification_email = 'nr-notify@local.test'$$, '1 row(s)', '1 row(s)');
-- B06 kept: blog admin updates the row
select pg_temp.check_write('B06', 'kept', :'uM', 'authenticated', '{}',
  $$with u as (update public.blog_settings set blog_title = 'nr' where id = 'c1590000-0000-4000-8000-0000000000e3' returning 1) select count(*) from u$$, '1 row(s)', '1 row(s)');
-- B07 kept: blog instructor cannot update the row
select pg_temp.check_write('B07', 'kept', :'uI', 'authenticated', '{}',
  $$with u as (update public.blog_settings set blog_title = 'nr' where id = 'c1590000-0000-4000-8000-0000000000e3' returning 1) select count(*) from u$$, '0 row(s)', '0 row(s)');

select case when pass then 'PASS ' else 'FAIL ' end || id || ' ' || kind || ' old=' || case when old_match then 'MATCH' else 'DIFF' end as line
  from results order by id;
select 'CHECKS ' || count(*) || ' closed ' || count(*) filter (where kind = 'closed') as line from results;
do $$ declare f int; begin select count(*) into f from results where not pass;
  if f > 0 then raise exception '% narrow-read check(s) failed', f; end if; end $$;
rollback;
