-- ABOUTME: Builder-authoring acceptance seed (UNRUN). Creates ONLY the two draft course shells in ids.mjs, owned by
-- ABOUTME: e2e-instructor. Refuses (plain INSERT, no ON CONFLICT) if any id already exists. Run after D1 and the actors.
\set ON_ERROR_STOP on
begin;
insert into public.courses (id, title, description, category, level, published, status, instructor_id) values
  ('9b6e0000-0000-4000-8000-000000000001', 'Builder Acceptance Course A', 'Synthetic builder acceptance fixture.', 'General', 'beginner', false, 'draft', 'e2e00000-0000-4000-8000-000000000002'),
  ('9b6e0000-0000-4000-8000-000000000002', 'Builder Acceptance Course B', 'Synthetic builder acceptance fixture.', 'General', 'beginner', false, 'draft', 'e2e00000-0000-4000-8000-000000000002');
insert into public.modules (id, course_id, title, position, published) values
  ('9b6e0000-0000-4000-8000-000000000011', '9b6e0000-0000-4000-8000-000000000001', 'BA Section One', 0, true),
  ('9b6e0000-0000-4000-8000-000000000012', '9b6e0000-0000-4000-8000-000000000001', 'BA Section Two', 1, true),
  ('9b6e0000-0000-4000-8000-000000000013', '9b6e0000-0000-4000-8000-000000000001', 'BA Section Three', 2, true),
  ('9b6e0000-0000-4000-8000-000000000021', '9b6e0000-0000-4000-8000-000000000002', 'BB Section One', 0, true),
  ('9b6e0000-0000-4000-8000-000000000022', '9b6e0000-0000-4000-8000-000000000002', 'BB Section Two', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, content, position, published, settings) values
  ('9b6e0000-0000-4000-8000-000000000101', '9b6e0000-0000-4000-8000-000000000001', '9b6e0000-0000-4000-8000-000000000011', 'page', 'BA Lesson Alpha', '', 0, false, '{}'),
  ('9b6e0000-0000-4000-8000-000000000102', '9b6e0000-0000-4000-8000-000000000001', '9b6e0000-0000-4000-8000-000000000011', 'page', 'BA Lesson Beta', '', 1, false, '{}'),
  ('9b6e0000-0000-4000-8000-000000000103', '9b6e0000-0000-4000-8000-000000000001', '9b6e0000-0000-4000-8000-000000000011', 'page', 'BA Lesson Gamma', '', 2, false, '{}'),
  ('9b6e0000-0000-4000-8000-000000000104', '9b6e0000-0000-4000-8000-000000000001', '9b6e0000-0000-4000-8000-000000000012', 'page', 'BA Lesson Deletable', '', 0, false, '{}'),
  ('9b6e0000-0000-4000-8000-000000000105', '9b6e0000-0000-4000-8000-000000000001', '9b6e0000-0000-4000-8000-000000000013', 'page', 'BA Lesson Vanishing', '', 0, false, '{}');
commit;
