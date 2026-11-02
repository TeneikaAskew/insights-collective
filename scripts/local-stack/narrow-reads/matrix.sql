-- ABOUTME: #159 narrow-reads role matrix on the LOCAL disposable snapshot stack: career_quiz_attempts, user_feedback and
-- ABOUTME: blog_settings, for anon, two students, an instructor and an admin, with and without a session-id header.
-- Fixture model: this matrix is TRANSACTION-ROLLED-BACK. Its actors and rows use the c159... ids, exist only inside this
-- transaction, and every count is restricted to those ids, so the committed baseline (baseline.sql,
-- b159... ids, used only for the preservation row hash) never changes a result here. Every write is undone by its own
-- subtransaction. Runners refuse non-loopback.
-- Usage: psql -v mode=OLD|NEW -f matrix.sql. Each check states its OLD and NEW expectation; mode picks one.
-- "closed" checks must FAIL in OLD (proof the check discriminates) and PASS in NEW; "kept" checks pass in both.
-- Output: "PASS <check>" / "FAIL <check> (got x, expected y)"; closing assertion "<n> narrow-read check(s) failed".
\set ON_ERROR_STOP on
begin;
select set_config('nr.mode', :'mode', true) is not null as mode_set \gset
do $$ begin if current_setting('nr.mode') not in ('OLD', 'NEW') then raise exception 'mode must be OLD or NEW'; end if; end $$;

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

create temp table results (name text, pass boolean, detail text);
-- The request.headers GUC is ALWAYS set ('{}' = no header): an unset GUC raises, which must be INVALID, never a pass.
create or replace function pg_temp.as_user(p_uid uuid, p_role text, p_headers text) returns void language plpgsql as $$
begin
  perform set_config('request.headers', p_headers, true);
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', p_role)::text else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
end $$;
create or replace function pg_temp.as_super() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); perform set_config('request.headers', '{}', true); end $$;
create or replace function pg_temp.want(p_old text, p_new text) returns text language sql as $$
  select case when current_setting('nr.mode') = 'OLD' then p_old else p_new end $$;

-- Visible rows, as the sorted list of their fixed tags (a..f), restricted to this matrix's own ids.
create or replace function pg_temp.check_rows(p_name text, p_uid uuid, p_role text, p_headers text, p_table text, p_old text, p_new text) returns void language plpgsql as $$
declare got text; want text := pg_temp.want(p_old, p_new);
begin
  perform pg_temp.as_user(p_uid, p_role, p_headers);
  begin
    execute format($q$select coalesce(string_agg(case right(id::text, 2) when 'a1' then 'QA' when 'b1' then 'QB' when 'f1' then 'QX'
      when 'a2' then 'FA' when 'b2' then 'FB' when 'f2' then 'FN' when 'e3' then 'BS' end, ',' order by id::text), '-')
      from public.%I where id::text like 'c1590000-0000-4000-8000-%%'$q$, p_table) into got;
  exception when insufficient_privilege then got := '-';
  end;
  perform pg_temp.as_super();
  insert into results values (p_name, got = want, format('got %s, expected %s', got, want));
end $$;

-- A write: 'allowed' or 'denied' (42501). Any other error propagates: infrastructure, never behaviour. The write is
-- always undone by raising a private SQLSTATE inside its own block.
create or replace function pg_temp.check_write(p_name text, p_uid uuid, p_role text, p_headers text, p_sql text, p_old text, p_new text) returns void language plpgsql as $$
declare got text; n int; want text := pg_temp.want(p_old, p_new);
begin
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
  insert into results values (p_name, got = want, format('got %s, expected %s', got, want));
end $$;

-- career_quiz_attempts SELECT
select pg_temp.check_rows('kept   quiz anon header SX sees the anonymous row', null, 'anon', '{"session-id":"nr-sess-x"}', 'career_quiz_attempts', 'QX', 'QX');
select pg_temp.check_rows('closed quiz anon header SA (a signed-in user''s session id) sees nothing', null, 'anon', '{"session-id":"nr-sess-a"}', 'career_quiz_attempts', 'QA', '-');
select pg_temp.check_rows('kept   quiz anon no header sees nothing', null, 'anon', '{}', 'career_quiz_attempts', '-', '-');
select pg_temp.check_rows('kept   quiz A no header sees own row', :'uA', 'authenticated', '{}', 'career_quiz_attempts', 'QA', 'QA');
select pg_temp.check_rows('closed quiz A header SB sees only own row', :'uA', 'authenticated', '{"session-id":"nr-sess-b"}', 'career_quiz_attempts', 'QA,QB', 'QA');
select pg_temp.check_rows('kept   quiz A header SX sees own and the anonymous row', :'uA', 'authenticated', '{"session-id":"nr-sess-x"}', 'career_quiz_attempts', 'QA,QX', 'QA,QX');
-- career_quiz_attempts INSERT
select pg_temp.check_write('kept   quiz anon header SX inserts an anonymous row', null, 'anon', '{"session-id":"nr-sess-x"}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values (null, 'nr-sess-x')$$, 'allowed', 'allowed');
select pg_temp.check_write('closed quiz anon header SA cannot insert as user A', null, 'anon', '{"session-id":"nr-sess-a"}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values ('c1590000-0000-4000-8000-00000000000a', 'nr-sess-a')$$, 'allowed', 'denied');
select pg_temp.check_write('kept   quiz A inserts own row', :'uA', 'authenticated', '{}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values ('c1590000-0000-4000-8000-00000000000a', 'nr-sess-a2')$$, 'allowed', 'allowed');
select pg_temp.check_write('closed quiz A header SB cannot insert as user B', :'uA', 'authenticated', '{"session-id":"nr-sess-b"}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values ('c1590000-0000-4000-8000-00000000000b', 'nr-sess-b')$$, 'allowed', 'denied');
select pg_temp.check_write('kept   quiz A no header cannot insert as user B', :'uA', 'authenticated', '{}',
  $$insert into public.career_quiz_attempts (user_id, session_id) values ('c1590000-0000-4000-8000-00000000000b', 'nr-sess-b')$$, 'denied', 'denied');

-- user_feedback
select pg_temp.check_rows('kept   feedback anon sees nothing', null, 'anon', '{}', 'user_feedback', '-', '-');
select pg_temp.check_rows('closed feedback A sees only own row', :'uA', 'authenticated', '{}', 'user_feedback', 'FA,FB,FN', 'FA');
select pg_temp.check_rows('closed feedback instructor sees nothing of others', :'uI', 'authenticated', '{}', 'user_feedback', 'FA,FB,FN', '-');
select pg_temp.check_rows('kept   feedback admin sees all', :'uM', 'authenticated', '{}', 'user_feedback', 'FA,FB,FN', 'FA,FB,FN');
select pg_temp.check_write('kept   feedback A inserts own row', :'uA', 'authenticated', '{}',
  $$insert into public.user_feedback (page_path, is_useful, user_id) values ('/nr', true, 'c1590000-0000-4000-8000-00000000000a')$$, 'allowed', 'allowed');
select pg_temp.check_write('kept   feedback A inserts a no-user row', :'uA', 'authenticated', '{}',
  $$insert into public.user_feedback (page_path, is_useful, user_id) values ('/nr', true, null)$$, 'allowed', 'allowed');
select pg_temp.check_write('kept   feedback A updates own row', :'uA', 'authenticated', '{}',
  $$with u as (update public.user_feedback set feedback_text = 'nr' where id = 'c1590000-0000-4000-8000-0000000000a2' returning 1) select count(*) from u$$, '1 row(s)', '1 row(s)');
select pg_temp.check_write('kept   feedback A cannot update B''s row', :'uA', 'authenticated', '{}',
  $$with u as (update public.user_feedback set feedback_text = 'nr' where id = 'c1590000-0000-4000-8000-0000000000b2' returning 1) select count(*) from u$$, '0 row(s)', '0 row(s)');

-- blog_settings
select pg_temp.check_rows('closed blog anon sees nothing', null, 'anon', '{}', 'blog_settings', 'BS', '-');
select pg_temp.check_rows('closed blog student sees nothing', :'uA', 'authenticated', '{}', 'blog_settings', 'BS', '-');
select pg_temp.check_rows('kept   blog instructor sees the row', :'uI', 'authenticated', '{}', 'blog_settings', 'BS', 'BS');
select pg_temp.check_rows('kept   blog admin sees the row', :'uM', 'authenticated', '{}', 'blog_settings', 'BS', 'BS');
select pg_temp.check_write('kept   blog instructor reads the FULL row incl. notification_email', :'uI', 'authenticated', '{}',
  $$select count(*) from public.blog_settings where id = 'c1590000-0000-4000-8000-0000000000e3' and notification_email = 'nr-notify@local.test'$$, '1 row(s)', '1 row(s)');
select pg_temp.check_write('kept   blog admin updates the row', :'uM', 'authenticated', '{}',
  $$with u as (update public.blog_settings set blog_title = 'nr' where id = 'c1590000-0000-4000-8000-0000000000e3' returning 1) select count(*) from u$$, '1 row(s)', '1 row(s)');
select pg_temp.check_write('kept   blog instructor cannot update the row', :'uI', 'authenticated', '{}',
  $$with u as (update public.blog_settings set blog_title = 'nr' where id = 'c1590000-0000-4000-8000-0000000000e3' returning 1) select count(*) from u$$, '0 row(s)', '0 row(s)');

select case when pass then 'PASS ' else 'FAIL ' end || name || case when pass then '' else ' (' || detail || ')' end as line from results order by name;
select 'CHECKS ' || count(*) || ' closed ' || count(*) filter (where name like 'closed %') as line from results;
do $$ declare f int; begin select count(*) into f from results where not pass;
  if f > 0 then raise exception '% narrow-read check(s) failed', f; end if; end $$;
rollback;
