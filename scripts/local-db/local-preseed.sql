-- ABOUTME: LOCAL-ONLY rows the E2E seed assumes already exist in the live project (the reference
-- ABOUTME: course, its modules, and the three e2e-* accounts), so e2e/fixtures/seed.sql can be
-- ABOUTME: rehearsed offline. Synthetic values throughout; never run against a Supabase project.
begin;
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e2e00000-0000-4000-8000-000000000001', 'e2e-admin@insightscollective.org',      extensions.crypt('local-only', extensions.gen_salt('bf')), now(), '{"provider":"email"}', '{"first_name":"E2E","last_name":"Admin"}'),
  ('e2e00000-0000-4000-8000-000000000002', 'e2e-instructor@insightscollective.org', extensions.crypt('local-only', extensions.gen_salt('bf')), now(), '{"provider":"email"}', '{"first_name":"E2E","last_name":"Instructor"}'),
  ('e2e00000-0000-4000-8000-000000000003', 'e2e-member@insightscollective.org',     extensions.crypt('local-only', extensions.gen_salt('bf')), now(), '{"provider":"email"}', '{"first_name":"E2E","last_name":"Member"}')
on conflict (id) do nothing;
insert into public.profiles (id) select id from auth.users where email like 'e2e-%@insightscollective.org' on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values
  ('e2e00000-0000-4000-8000-000000000001','admin'),
  ('e2e00000-0000-4000-8000-000000000002','instructor'),
  ('e2e00000-0000-4000-8000-000000000003','student')
on conflict do nothing;
insert into public.courses (id, title, description, category, level, published, instructor_id)
values ('660e8400-e29b-41d4-a716-446655440001', 'Introduction to Data Science', 'Reference course (local rehearsal copy)', 'data-science', 'beginner', true, 'e2e00000-0000-4000-8000-000000000002')
on conflict (id) do nothing;
-- The seed asserts at least five fixture courses with ids 660e8400-…; production holds them, so
-- the rehearsal supplies synthetic stand-ins for 0002..0005 (0002 is the certificate-journey course).
insert into public.courses (id, title, description, category, level, published, instructor_id)
select ('660e8400-e29b-41d4-a716-44665544000' || n)::uuid, 'Fixture course ' || n, 'Local rehearsal copy', 'data-science', 'beginner', true, 'e2e00000-0000-4000-8000-000000000002'
from generate_series(2,5) n on conflict (id) do nothing;
insert into public.modules (id, course_id, title, position, published)
values ('770e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440002', 'Module 1', 1, true)
on conflict (id) do nothing;
-- The reference course's modules carry the production titles and weeks that e2e/courses/course-detail.spec.ts
-- asserts and that 20251005171349 locates by week (1..3); synthetic ids, local rehearsal only.
insert into public.modules (id, course_id, title, week, position, published)
values ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Foundations of Data Science', 1, 1, true),
       ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'Python for Data Analysis', 2, 2, true),
       ('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 'Statistical Methods', 3, 3, true)
on conflict (id) do nothing;
commit;
