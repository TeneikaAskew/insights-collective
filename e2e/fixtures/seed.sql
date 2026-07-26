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
--
-- NOT ON CONFLICT DO NOTHING: course_material_files has no unique constraint on
-- (course_id, storage_path) — its only unique index is the surrogate id, which a
-- fresh gen_random_uuid() never collides with. The clause therefore never fired
-- and this "safe to run repeatedly" seed appended another Welcome.pdf on every
-- run (verified: 1 row before, 2 after). NOT EXISTS is the guard that matches
-- the constraint that actually exists.
INSERT INTO public.course_material_files (course_id, name, storage_path, bucket, mime_type, size_bytes, uploaded_by)
SELECT '660e8400-e29b-41d4-a716-446655440001', 'Welcome.pdf',
       '660e8400-e29b-41d4-a716-446655440001/welcome.pdf', 'course-documents',
       'application/pdf', 1024, c.instructor_id
FROM public.courses c
WHERE c.id = '660e8400-e29b-41d4-a716-446655440001'
  AND NOT EXISTS (
    SELECT 1 FROM public.course_material_files f
    WHERE f.course_id = '660e8400-e29b-41d4-a716-446655440001'
      AND f.storage_path = '660e8400-e29b-41d4-a716-446655440001/welcome.pdf'
  );

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

  -- Everything this script INSERTs sits inside `IF v_member_id IS NOT NULL`
  -- style guards, so a missed auth.users lookup (wrong email, account not
  -- created yet) made the whole script a silent no-op that still COMMITted and
  -- reported success. Only the two checks above were asserted, and both cover
  -- rows the script does not create. Assert its own output too.

  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN auth.users u ON u.id = e.user_id
    WHERE e.course_id = '660e8400-e29b-41d4-a716-446655440001'
      AND u.email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org')
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: member is not enrolled in 660e8400-...0001; every enrolled-course spec would assert against an empty dashboard';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.certificates c
    JOIN auth.users u ON u.id = c.user_id
    WHERE c.course_id = '660e8400-e29b-41d4-a716-446655440001'
      AND u.email = 'e2e-member@insightscollective.org'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: member certificate missing; profile-certificates-flow and the /profile visual baseline both depend on it';
  END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM public.course_material_files
   WHERE course_id = '660e8400-e29b-41d4-a716-446655440001'
     AND storage_path = '660e8400-e29b-41d4-a716-446655440001/welcome.pdf';
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: expected exactly one seeded Welcome.pdf — this script is meant to be idempotent';
  END IF;

  SELECT c.instructor_id IS NOT NULL INTO v_ok
    FROM public.courses c WHERE c.id = '660e8400-e29b-41d4-a716-446655440001';
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture course has no instructor_id; every instructor-role spec would hit a permission fallback';
  END IF;
END $$;

COMMIT;
