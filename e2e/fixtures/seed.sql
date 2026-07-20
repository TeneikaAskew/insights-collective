-- ABOUTME: Idempotent seed for deterministic Playwright test fixtures.
-- ABOUTME: Run against the target Supabase project before executing the e2e suite.
-- Usage: psql "$SUPABASE_DB_URL" -f e2e/fixtures/seed.sql
-- Safe to run repeatedly. Uses stable UUIDs so tests can reference known rows.

BEGIN;

-- Reference course (already exists in production seed): Introduction to Data Science
-- id = 660e8400-e29b-41d4-a716-446655440001

-- Ensure the enrolled test member exists and has an enrollment.
DO $$
DECLARE
  v_member_id uuid;
  v_course_id uuid := '660e8400-e29b-41d4-a716-446655440001';
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'test@insightscollective.org');
  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.enrollments (user_id, course_id)
    VALUES (v_member_id, v_course_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

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
