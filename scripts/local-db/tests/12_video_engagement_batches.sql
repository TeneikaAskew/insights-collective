-- ABOUTME: Behavioural test of 20261112000000 (idempotent video engagement batches) and 20261112000100 (course-scoped
-- ABOUTME: instructor reads of video_analytics) on the LOCAL snapshot: who may write and read, and that retries never double count.
-- Tier: schema snapshot on PostgreSQL 16 with real grants and RLS; actors act as anon/authenticated with PostgREST
-- claims. Not live, not a browser. Without the two migrations the B checks fail (no function) and I2/I3 fail
-- (a co-instructor and an admin without the instructor role read nothing). Synthetic rows, one transaction, rolled back.
\set ON_ERROR_STOP on
begin;
\set owner  'c1111111-1111-4111-8111-111111111111'
\set coinst 'c2222222-2222-4222-8222-222222222222'
\set other  'c3333333-3333-4333-8333-333333333333'
\set learnA 'c4444444-4444-4444-8444-444444444444'
\set learnB 'c5555555-5555-4555-8555-555555555555'
\set admin  'c6666666-6666-4666-8666-666666666666'
\set course 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
\set ocrs   'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
\set mod    'cccccccc-0000-4000-8000-000000000001'
\set item   'cccccccc-0000-4000-8000-000000000011'
\set b1     'cccccccc-baaa-4000-8000-000000000001'
\set b2     'cccccccc-baaa-4000-8000-000000000002'
insert into auth.users (id, email) values (:'owner','v-owner@local.test'), (:'coinst','v-coinst@local.test'),
  (:'other','v-other@local.test'), (:'learnA','v-a@local.test'), (:'learnB','v-b@local.test'), (:'admin','v-admin@local.test');
insert into public.profiles (id) select id from auth.users where id in (:'owner',:'coinst',:'other',:'learnA',:'learnB',:'admin') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'owner','instructor'), (:'coinst','instructor'), (:'other','instructor'),
  (:'learnA','student'), (:'learnB','student'), (:'admin','admin') on conflict do nothing;
insert into public.courses (id, title, description, category, level, instructor_id, published) values
  (:'course','Video course','synthetic','General','beginner', :'owner', true),
  (:'ocrs','Other course','synthetic','General','beginner', :'other', true);
insert into public.course_assignments (course_id, user_id, role) values (:'course', :'coinst', 'instructor');
insert into public.modules (id, course_id, title, position, published) values (:'mod', :'course', 'S1', 0, true);
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  (:'item', :'course', :'mod', 'page', 'Video lesson', 0, true);
insert into public.enrollments (user_id, course_id) values (:'learnA', :'course'), (:'learnB', :'course');

create temp table results (name text, pass boolean, detail text); grant all on results to public;
create or replace function pg_temp.as_api(p_uid uuid, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', p_role)::text
                                                else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('role', p_role, true);
end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text) returns void language plpgsql as $$
begin insert into results values (p_name, coalesce(p_ok, false), coalesce(p_detail, '')); end $$;
-- run p_sql as the API caller in a subtransaction; returns the first column of its first row, 'accepted', or 'REFUSED: <error>'
create or replace function pg_temp.api(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare r text;
begin perform pg_temp.as_api(p_uid, p_role);
  begin execute p_sql into r; r := coalesce(r, 'accepted'); exception when others then r := 'REFUSED: ' || sqlerrm; end;
  perform pg_temp.as_postgres(); return r; end $$;
create or replace function pg_temp.batch(p_batch uuid, p_watch int, p_play int, p_pause int, p_cov int default null) returns text language sql as $$
  select format('select outcome || '' '' || watch_time || ''/'' || play_count || ''/'' || pause_count from public.apply_video_engagement_batch(%L::uuid, %L::uuid, %s, %s, %s, 0, 1, 120, 1.0, %s)',
    'cccccccc-0000-4000-8000-000000000011', p_batch, p_watch, p_play, p_pause, coalesce(p_cov::text, 'null')) $$;
create or replace function pg_temp.totals(p_uid uuid) returns text language sql as $$
  select coalesce((select watch_time || '/' || play_count || '/' || pause_count from public.video_analytics
    where user_id = p_uid and content_item_id = 'cccccccc-0000-4000-8000-000000000011'), 'none') $$;
create or replace function pg_temp.visible(p_uid uuid) returns text language sql as $$
  select format('select count(*)::text from public.video_analytics where content_item_id = %L', 'cccccccc-0000-4000-8000-000000000012') $$;

create or replace function pg_temp.ledger(p_uid uuid) returns int language plpgsql as $$
declare n int;
begin execute 'select count(*) from public.video_engagement_batches where user_id = $1' into n using p_uid; return n;
exception when undefined_table then return -1; end $$;

-- ===== B. Idempotent batches =====
select pg_temp.check('B1 a learner''s first batch creates their row with exactly that batch',
  pg_temp.api(:'learnA', 'authenticated', pg_temp.batch(:'b1', 10, 1, 0)) = 'applied 10/1/0'
  and pg_temp.totals(:'learnA') = '10/1/0', pg_temp.totals(:'learnA'));
select pg_temp.check('B2 a second batch from another tab adds to it',
  pg_temp.api(:'learnA', 'authenticated', pg_temp.batch(:'b2', 5, 0, 1)) = 'applied 15/1/1', pg_temp.totals(:'learnA'));
select pg_temp.check('B3 retrying the committed first batch after the row changed is not applied again',
  pg_temp.api(:'learnA', 'authenticated', pg_temp.batch(:'b1', 10, 1, 0)) = 'already-applied 15/1/1'
  and pg_temp.api(:'learnA', 'authenticated', pg_temp.batch(:'b1', 10, 1, 0)) = 'already-applied 15/1/1'
  and pg_temp.totals(:'learnA') = '15/1/1', pg_temp.totals(:'learnA'));
select pg_temp.check('B4 batch ids are per learner: B reusing A''s id writes only B''s row',
  pg_temp.api(:'learnB', 'authenticated', pg_temp.batch(:'b1', 3, 1, 0)) = 'applied 3/1/0'
  and pg_temp.totals(:'learnA') = '15/1/1', pg_temp.totals(:'learnB'));
select pg_temp.check('B5 a learner cannot record a batch in another learner''s name',
  pg_temp.api(:'learnA', 'authenticated', format('insert into public.video_engagement_batches (user_id, batch_id, content_item_id) values (%L, gen_random_uuid(), %L)', :'learnB', :'item')) like 'REFUSED%', '');
select pg_temp.check('B6 a learner neither sees nor updates another learner''s row',
  pg_temp.api(:'learnA', 'authenticated', format('select count(*)::text from public.video_analytics where user_id = %L', :'learnB')) = '0'
  and pg_temp.api(:'learnA', 'authenticated', format('with u as (update public.video_analytics set watch_time = 999 where user_id = %L returning 1) select count(*)::text from u', :'learnB')) = '0'
  and pg_temp.totals(:'learnB') = '3/1/0', pg_temp.totals(:'learnB'));
select pg_temp.check('B7 anon cannot call it, nor can a session without a user',
  pg_temp.api(null, 'anon', pg_temp.batch(gen_random_uuid(), 1, 0, 0)) like 'REFUSED%'
  and pg_temp.api(null, 'authenticated', pg_temp.batch(gen_random_uuid(), 1, 0, 0)) like 'REFUSED%not authenticated%', '');
select pg_temp.check('B8 a negative delta is refused and nothing is written',
  pg_temp.api(:'learnA', 'authenticated', pg_temp.batch(gen_random_uuid(), -5, 0, 0)) like 'REFUSED%'
  and pg_temp.totals(:'learnA') = '15/1/1', pg_temp.totals(:'learnA'));
select pg_temp.check('B9 a batch for a lesson that does not exist is refused and leaves no ledger row',
  pg_temp.api(:'learnA', 'authenticated', format('select outcome from public.apply_video_engagement_batch(%L::uuid, gen_random_uuid(), 1)', 'cccccccc-0000-4000-8000-0000000000ff')) like 'REFUSED%'
  and pg_temp.ledger(:'learnA') = 2, pg_temp.ledger(:'learnA')::text);
select pg_temp.check('B10a without coverage nothing completes',
  (select not coalesce(completed, false) from public.video_analytics where user_id = :'learnA'), '');
select pg_temp.check('B10b a batch with 95% coverage is applied',
  pg_temp.api(:'learnB', 'authenticated', pg_temp.batch(gen_random_uuid(), 1, 0, 0, 95)) like 'applied%', '');
select pg_temp.check('B10c ...and the existing trigger still auto-completes it, as before',
  coalesce((select completed from public.video_analytics where user_id = :'learnB'), false), '');

-- ===== I. Who reads a course's video stats (rows seeded directly, so these do not depend on the function) =====
insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  ('cccccccc-0000-4000-8000-000000000012', :'course', :'mod', 'page', 'Second video lesson', 1, true);
insert into public.video_analytics (user_id, content_item_id, watch_time) values
  (:'learnA', 'cccccccc-0000-4000-8000-000000000012', 4), (:'learnB', 'cccccccc-0000-4000-8000-000000000012', 6);
select pg_temp.check('I1 the course owner reads both learners'' rows',
  pg_temp.api(:'owner', 'authenticated', pg_temp.visible(:'owner')) = '2', pg_temp.api(:'owner', 'authenticated', pg_temp.visible(:'owner')));
select pg_temp.check('I2 an assigned co-instructor reads both learners'' rows',
  pg_temp.api(:'coinst', 'authenticated', pg_temp.visible(:'coinst')) = '2', pg_temp.api(:'coinst', 'authenticated', pg_temp.visible(:'coinst')));
select pg_temp.check('I3 an admin without the instructor role reads both learners'' rows',
  pg_temp.api(:'admin', 'authenticated', pg_temp.visible(:'admin')) = '2', pg_temp.api(:'admin', 'authenticated', pg_temp.visible(:'admin')));
select pg_temp.check('I4 an instructor of another course reads none',
  pg_temp.api(:'other', 'authenticated', pg_temp.visible(:'other')) = '0', pg_temp.api(:'other', 'authenticated', pg_temp.visible(:'other')));
select pg_temp.check('I5 a learner reads only their own row',
  pg_temp.api(:'learnA', 'authenticated', pg_temp.visible(:'learnA')) = '1', pg_temp.api(:'learnA', 'authenticated', pg_temp.visible(:'learnA')));
select pg_temp.check('I6 anon reads none',
  pg_temp.api(null, 'anon', pg_temp.visible(null)) in ('0') or pg_temp.api(null, 'anon', pg_temp.visible(null)) like 'REFUSED%',
  pg_temp.api(null, 'anon', pg_temp.visible(null)));

select (case when pass then 'PASS ' else 'FAIL ' end) || name || case when detail <> '' then '  [' || detail || ']' else '' end from results order by name;
select 'SUMMARY ' || count(*) filter (where pass) || '/' || count(*) || ' pass' from results;
do $$ declare n int; begin select count(*) into n from results where not pass; if n > 0 then raise exception '% check(s) FAILED', n; end if; end $$;
rollback;
