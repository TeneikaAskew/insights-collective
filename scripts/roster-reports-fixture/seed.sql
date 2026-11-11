-- ABOUTME: Synthetic, run-owned seed for the T-15 Students/Reports acceptance (disposable local stack only).
-- ABOUTME: Writes the MANIFEST.tsv ids except the RR course (the carrier, applied first). Refuses unless exactly the carrier exists.
--
-- Prerequisites (shared runner, unchanged): local-preseed.sql actors e2e-admin/e2e-instructor/e2e-member exist.
-- Legacy enrollments.completion_status is set LAST to values that contradict the progression evidence, so a page that
-- still read it would show different headline numbers (legacy 40%/40%/2 vs evidence 20%/35%/1).
\set ON_ERROR_STOP 1
begin;

do $$
declare n int;
begin
  if (select count(*) from auth.users where email in ('e2e-admin@insightscollective.org','e2e-instructor@insightscollective.org','e2e-member@insightscollective.org')) <> 3 then
    raise exception 'RR_SEED_E_ACTORS: the three shared actors are not present';
  end if;
  -- Exactly the pre-seed carrier must exist: the RR course with a 32-hex association nonce, and no other fixture row.
  if (select count(*) from public.courses where id = '7150a000-0000-4000-8000-000000000001' and description ~ '^rr-association:[0-9a-f]{32}$') <> 1 then
    raise exception 'RR_SEED_E_CARRIER: the association carrier is not present';
  end if;
  select count(*) into n from (
    select id from public.courses where id::text like '7150a000-%' and id <> '7150a000-0000-4000-8000-000000000001'
    union all select id from public.modules where id::text like '7150a000-%'
    union all select id from public.content_items where id::text like '7150a000-%'
    union all select id from auth.users where id::text like '7150a000-%'
    union all select id from public.enrollments where id::text like '7150a000-%'
    union all select id from public.content_item_progressions where id::text like '7150a000-%') x;
  if n <> 0 then raise exception 'RR_SEED_E_EXISTS: % fixture row(s) already present', n; end if;
end $$;

-- Synthetic learners and one other instructor. No password: they never sign in.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
  ('7150a000-0000-4000-8000-000000000201', 'rr-l1@fixture.invalid', null, now(), '{"provider":"email"}', '{"first_name":"Ada","last_name":"Fixture"}'),
  ('7150a000-0000-4000-8000-000000000202', 'rr-l2@fixture.invalid', null, now(), '{"provider":"email"}', '{"first_name":"Grace","last_name":"Fixture"}'),
  ('7150a000-0000-4000-8000-000000000203', 'rr-l3@fixture.invalid', null, now(), '{"provider":"email"}', '{"first_name":"Alan","last_name":"Fixture"}'),
  ('7150a000-0000-4000-8000-000000000204', 'rr-l4@fixture.invalid', null, now(), '{"provider":"email"}', '{"first_name":"Edsger","last_name":"Fixture"}'),
  ('7150a000-0000-4000-8000-000000000f01', 'rr-other@fixture.invalid', null, now(), '{"provider":"email"}', '{"first_name":"Olive","last_name":"Fixture"}');
-- A profile trigger may already have created the rows; names are set on fixture ids only.
insert into public.profiles (id, first_name, last_name) values
  ('7150a000-0000-4000-8000-000000000201', 'Ada', 'Fixture'),
  ('7150a000-0000-4000-8000-000000000202', 'Grace', 'Fixture'),
  ('7150a000-0000-4000-8000-000000000203', 'Alan', 'Fixture'),
  ('7150a000-0000-4000-8000-000000000204', 'Edsger', 'Fixture'),
  ('7150a000-0000-4000-8000-000000000f01', 'Olive', 'Fixture')
on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name;

insert into public.courses (id, title, description, category, level, published, instructor_id) values
  ('7150a000-0000-4000-8000-000000000002', 'RR Fixture Empty Course', 'RR fixture', 'data-science', 'beginner', true, 'e2e00000-0000-4000-8000-000000000002'),
  ('7150a000-0000-4000-8000-000000000003', 'RR Fixture Other Course', 'RR fixture', 'data-science', 'beginner', true, '7150a000-0000-4000-8000-000000000f01');

insert into public.modules (id, course_id, title, position, published) values
  ('7150a000-0000-4000-8000-000000000011', '7150a000-0000-4000-8000-000000000001', 'RR Published Section', 1, true),
  ('7150a000-0000-4000-8000-000000000012', '7150a000-0000-4000-8000-000000000001', 'RR Draft Section', 2, false),
  ('7150a000-0000-4000-8000-000000000013', '7150a000-0000-4000-8000-000000000002', 'RR Empty Section', 1, true),
  ('7150a000-0000-4000-8000-000000000014', '7150a000-0000-4000-8000-000000000003', 'RR Other Section', 1, true);

insert into public.content_items (id, course_id, module_id, type, title, position, published) values
  ('7150a000-0000-4000-8000-000000000101', '7150a000-0000-4000-8000-000000000001', '7150a000-0000-4000-8000-000000000011', 'page', 'RR Lesson 1', 1, true),
  ('7150a000-0000-4000-8000-000000000102', '7150a000-0000-4000-8000-000000000001', '7150a000-0000-4000-8000-000000000011', 'page', 'RR Lesson 2', 2, true),
  ('7150a000-0000-4000-8000-000000000103', '7150a000-0000-4000-8000-000000000001', '7150a000-0000-4000-8000-000000000011', 'page', 'RR Lesson 3', 3, true),
  ('7150a000-0000-4000-8000-000000000104', '7150a000-0000-4000-8000-000000000001', '7150a000-0000-4000-8000-000000000011', 'page', 'RR Lesson 4', 4, true),
  ('7150a000-0000-4000-8000-000000000105', '7150a000-0000-4000-8000-000000000001', '7150a000-0000-4000-8000-000000000011', 'page', 'RR Unpublished Lesson', 5, false),
  ('7150a000-0000-4000-8000-000000000106', '7150a000-0000-4000-8000-000000000001', '7150a000-0000-4000-8000-000000000012', 'page', 'RR Lesson In Draft Section', 1, true),
  ('7150a000-0000-4000-8000-000000000107', '7150a000-0000-4000-8000-000000000002', '7150a000-0000-4000-8000-000000000013', 'page', 'RR Empty Unpublished Lesson', 1, false),
  ('7150a000-0000-4000-8000-000000000108', '7150a000-0000-4000-8000-000000000003', '7150a000-0000-4000-8000-000000000014', 'page', 'RR Other Lesson', 1, true);

insert into public.enrollments (id, user_id, course_id, enrolled_at) values
  ('7150a000-0000-4000-8000-000000000301', '7150a000-0000-4000-8000-000000000201', '7150a000-0000-4000-8000-000000000001', now() - interval '60 days'),
  ('7150a000-0000-4000-8000-000000000302', '7150a000-0000-4000-8000-000000000202', '7150a000-0000-4000-8000-000000000001', now() - interval '45 days'),
  ('7150a000-0000-4000-8000-000000000303', '7150a000-0000-4000-8000-000000000203', '7150a000-0000-4000-8000-000000000001', now() - interval '30 days'),
  ('7150a000-0000-4000-8000-000000000304', '7150a000-0000-4000-8000-000000000204', '7150a000-0000-4000-8000-000000000001', now() - interval '2 days'),
  ('7150a000-0000-4000-8000-000000000305', 'e2e00000-0000-4000-8000-000000000003', '7150a000-0000-4000-8000-000000000001', now() - interval '20 days'),
  ('7150a000-0000-4000-8000-000000000311', '7150a000-0000-4000-8000-000000000201', '7150a000-0000-4000-8000-000000000002', now() - interval '60 days'),
  ('7150a000-0000-4000-8000-000000000312', 'e2e00000-0000-4000-8000-000000000003', '7150a000-0000-4000-8000-000000000002', now() - interval '20 days'),
  ('7150a000-0000-4000-8000-000000000321', '7150a000-0000-4000-8000-000000000202', '7150a000-0000-4000-8000-000000000003', now() - interval '45 days');

insert into public.content_item_progressions (id, user_id, content_item_id, workflow_state) values
  ('7150a000-0000-4000-8000-000000000401', '7150a000-0000-4000-8000-000000000201', '7150a000-0000-4000-8000-000000000101', 'completed'),
  ('7150a000-0000-4000-8000-000000000402', '7150a000-0000-4000-8000-000000000201', '7150a000-0000-4000-8000-000000000102', 'completed'),
  ('7150a000-0000-4000-8000-000000000403', '7150a000-0000-4000-8000-000000000201', '7150a000-0000-4000-8000-000000000103', 'read'),
  ('7150a000-0000-4000-8000-000000000404', '7150a000-0000-4000-8000-000000000201', '7150a000-0000-4000-8000-000000000104', 'completed'),
  ('7150a000-0000-4000-8000-000000000405', '7150a000-0000-4000-8000-000000000202', '7150a000-0000-4000-8000-000000000101', 'read'),
  ('7150a000-0000-4000-8000-000000000406', '7150a000-0000-4000-8000-000000000202', '7150a000-0000-4000-8000-000000000102', 'completed'),
  ('7150a000-0000-4000-8000-000000000407', '7150a000-0000-4000-8000-000000000202', '7150a000-0000-4000-8000-000000000103', 'started'),
  ('7150a000-0000-4000-8000-000000000408', 'e2e00000-0000-4000-8000-000000000003', '7150a000-0000-4000-8000-000000000101', 'completed'),
  ('7150a000-0000-4000-8000-000000000409', 'e2e00000-0000-4000-8000-000000000003', '7150a000-0000-4000-8000-000000000105', 'read'),
  ('7150a000-0000-4000-8000-000000000410', 'e2e00000-0000-4000-8000-000000000003', '7150a000-0000-4000-8000-000000000106', 'read'),
  ('7150a000-0000-4000-8000-000000000411', '7150a000-0000-4000-8000-000000000201', '7150a000-0000-4000-8000-000000000107', 'read'),
  ('7150a000-0000-4000-8000-000000000412', '7150a000-0000-4000-8000-000000000202', '7150a000-0000-4000-8000-000000000108', 'completed');

-- Legacy column LAST, contradicting the evidence (a trigger may have touched it above).
update public.enrollments set completion_status = v.cs
from (values
  ('7150a000-0000-4000-8000-000000000301'::uuid, 0), ('7150a000-0000-4000-8000-000000000302'::uuid, 100),
  ('7150a000-0000-4000-8000-000000000303'::uuid, 100), ('7150a000-0000-4000-8000-000000000304'::uuid, 0),
  ('7150a000-0000-4000-8000-000000000305'::uuid, 0), ('7150a000-0000-4000-8000-000000000311'::uuid, 100),
  ('7150a000-0000-4000-8000-000000000312'::uuid, 100), ('7150a000-0000-4000-8000-000000000321'::uuid, 100)) as v(id, cs)
where public.enrollments.id = v.id;

commit;
select 'RR_SEED_OK';
