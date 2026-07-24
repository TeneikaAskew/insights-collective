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

-- Seed one course material file so the enrolled-student signed-URL journey has a row to click.
INSERT INTO public.course_material_files (course_id, name, storage_path, bucket, mime_type, size_bytes, uploaded_by)
SELECT '660e8400-e29b-41d4-a716-446655440001', 'Welcome.pdf',
       '660e8400-e29b-41d4-a716-446655440001/welcome.pdf', 'course-documents',
       'application/pdf', 1024, c.instructor_id
FROM public.courses c WHERE c.id = '660e8400-e29b-41d4-a716-446655440001'
ON CONFLICT DO NOTHING;

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
END $$;

COMMIT;
