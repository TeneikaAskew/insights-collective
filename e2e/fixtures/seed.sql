-- ABOUTME: Idempotent seed for deterministic Playwright test fixtures.
-- ABOUTME: Run against the target Supabase project before executing the e2e suite.
-- Usage: psql "$SUPABASE_DB_URL" -f e2e/fixtures/seed.sql
-- Safe to run repeatedly. Uses stable identifiers so tests can reference known rows.

BEGIN;

-- Reference course (already exists in production seed): Introduction to Data Science
-- id = 660e8400-e29b-41d4-a716-446655440001

-- 1. Ensure the enrolled member has an enrollment on the reference course.
DO $$
DECLARE
  v_course_id uuid := '660e8400-e29b-41d4-a716-446655440001';
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org');
  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.enrollments (user_id, course_id)
    VALUES (v_member_id, v_course_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 2. Ensure the dedicated instructor is set as the primary instructor of the reference course.
DO $$
DECLARE
  v_course_id uuid := '660e8400-e29b-41d4-a716-446655440001';
  v_instructor_id uuid;
BEGIN
  SELECT id INTO v_instructor_id FROM auth.users
   WHERE email = 'e2e-instructor@insightscollective.org';
  IF v_instructor_id IS NOT NULL THEN
    UPDATE public.courses SET instructor_id = v_instructor_id
     WHERE id = v_course_id AND instructor_id IS DISTINCT FROM v_instructor_id;
  END IF;
END $$;

-- 3. Seed a completion certificate for the member so the profile "My Certificates"
--    verify-link test can exercise a real row instead of skipping.
DO $$
DECLARE
  v_course_id uuid := '660e8400-e29b-41d4-a716-446655440001';
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = 'e2e-member@insightscollective.org';
  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.certificates (user_id, course_id, certificate_type, certificate_data, verification_code, issued_at)
    VALUES (
      v_member_id, v_course_id, 'completion',
      jsonb_build_object('completion_percentage', 100, 'total_items', 11, 'auto_issued', false, 'seeded_for', 'e2e'),
      'E2EMEMBERCERT', now()
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET verification_code = EXCLUDED.verification_code,
        certificate_data = EXCLUDED.certificate_data;
  END IF;
END $$;

-- 4. Seed a published assignment with a submitted (ungraded) submission from the
--    member. Without this the instructor's /manage/assignments dashboard renders
--    its empty state, so grading-workflow-flow finds no "Grade submissions" link
--    and assignment-submission-feedback / full-completion-sequence find no
--    assignment UI to act on. Fixed id so specs can deep-link if they need to.
DO $$
DECLARE
  v_course_id uuid := '660e8400-e29b-41d4-a716-446655440001';
  v_assignment_id uuid := 'aa0e8400-e29b-41d4-a716-446655440001';
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = 'e2e-member@insightscollective.org';

  INSERT INTO public.assignments (id, course_id, title, description, instructions, points, due_date, is_published, submission_types)
  VALUES (
    v_assignment_id, v_course_id,
    'E2E Fixture Assignment',
    'Seeded assignment backing the grading and submission journeys.',
    'Submit a short written response. Seeded for E2E; safe to leave in place.',
    100, now() + interval '30 days', true, ARRAY['online_text_entry']
  )
  ON CONFLICT (id) DO UPDATE
  SET is_published = true,
      course_id = EXCLUDED.course_id,
      points = EXCLUDED.points;

  -- workflow_state 'submitted' (not 'graded') so the dashboard shows a gradable
  -- item and the SpeedGrader has something to open.
  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.assignment_submissions
      (assignment_id, user_id, submitted_at, submission_type, body, workflow_state, attempt)
    VALUES (
      v_assignment_id, v_member_id, now(), 'online_text_entry',
      'Seeded E2E submission body.', 'submitted', 1
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed one course material file so the enrolled-student signed-URL journey has a row to click.
INSERT INTO public.course_material_files (course_id, name, storage_path, bucket, mime_type, size_bytes, uploaded_by)
SELECT '660e8400-e29b-41d4-a716-446655440001', 'Welcome.pdf',
       '660e8400-e29b-41d4-a716-446655440001/welcome.pdf', 'course-documents',
       'application/pdf', 1024, c.instructor_id
FROM public.courses c WHERE c.id = '660e8400-e29b-41d4-a716-446655440001'
ON CONFLICT DO NOTHING;

-- Seed the event the specs deep-link to. Without this the default id in
-- e2e/helpers/route-helpers.ts resolves to Event Not Found on a fresh
-- database, and event-detail.spec.ts still passes on generic headings —
-- false-green coverage rather than a tested page.
INSERT INTO public.events (id, title, description, type, format, date, location, capacity)
VALUES ('dd0e8400-e29b-41d4-a716-446655440001',
        'Data Science Career Panel',
        'A panel of working data scientists on breaking into the field.',
        'panel', 'virtual', CURRENT_DATE + 30, 'Zoom', 100)
ON CONFLICT (id) DO NOTHING;

-- Assert deterministic invariants so a failed seed surfaces before tests run.
DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT COUNT(*) >= 5 INTO v_ok FROM public.courses
   WHERE id::text LIKE '660e8400%';
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: expected at least 5 fixture courses (660e8400-...)';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.events WHERE id = 'dd0e8400-e29b-41d4-a716-446655440001'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture event dd0e8400-...0001 missing; event specs would pass against a Not Found page';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE a.id = 'aa0e8400-e29b-41d4-a716-446655440001'
      AND a.is_published
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture assignment aa0e8400-...0001 has no submission; the grading dashboard would render its empty state and grading specs would fail on a seed gap';
  END IF;
END $$;

COMMIT;
