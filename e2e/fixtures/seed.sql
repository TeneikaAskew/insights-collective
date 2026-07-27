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
--
--    Deliberately NOT on the primary fixture course (E2E_TEST_COURSE_ID,
--    660e8400-...0001). certificate-generation.spec.ts and
--    full-completion-sequence.spec.ts both prove auto-issuance from a clean
--    slate, so they open by deleting the member's certificate for that course
--    -- which RLS lets them do ("Users can delete their own certificates").
--    The suite is fullyParallel with 4 CI workers and all three specs are in
--    the chromium-member project, so seeding this row on ...0001 put it in a
--    race it loses roughly half the time: the profile spec would read zero
--    rows and fail with a "Seed gap" message blaming a seed that had in fact
--    applied cleanly. Course ...0002 is read-only for every other spec, so
--    this row is nobody else's to delete.
DO $$
DECLARE
  v_course_id uuid := '660e8400-e29b-41d4-a716-446655440002';
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = 'e2e-member@insightscollective.org';
  IF v_member_id IS NOT NULL THEN
    -- verification_code is globally UNIQUE, so a row left on the old course by
    -- an earlier revision of this seed would collide -- and ON CONFLICT
    -- (user_id, course_id) below does not catch a verification_code conflict,
    -- so psql would abort the whole seed under ON_ERROR_STOP. Clear it first,
    -- scoped to this member's own row carrying exactly this fixture code.
    DELETE FROM public.certificates
     WHERE user_id = v_member_id
       AND verification_code = 'E2EMEMBERCERT'
       AND course_id <> v_course_id;

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
  v_item_id uuid := 'cc0e8400-e29b-41d4-a716-446655440001';
  v_module_id uuid;
  v_member_id uuid;
  v_position integer;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = 'e2e-member@insightscollective.org';
  SELECT id INTO v_module_id FROM public.modules
   WHERE course_id = v_course_id ORDER BY created_at LIMIT 1;

  -- content_items has a unique (module_id, position); take the next free slot
  -- rather than a fixed number, which collides with whatever the course already
  -- has. On conflict the existing position is deliberately left alone.
  SELECT COALESCE(max(ci.position), 0) + 1 INTO v_position
    FROM public.content_items ci
   WHERE ci.module_id = v_module_id;

  -- The assignment MUST hang off a content item. InstructorAssignments renders
  -- the "Grade submissions" link only when content_item_id is set (otherwise a
  -- disabled "No submissions target" button), and CanvasGradingInterface
  -- resolves the :contentItemId route param — so a null here leaves the
  -- SpeedGrader unreachable and grading-workflow-flow still failing.
  INSERT INTO public.content_items (id, course_id, module_id, type, title, position, published)
  VALUES (v_item_id, v_course_id, v_module_id, 'assignment', 'E2E Fixture Assignment', v_position, true)
  ON CONFLICT (id) DO UPDATE
  SET published = true,
      course_id = EXCLUDED.course_id,
      module_id = EXCLUDED.module_id,
      type = EXCLUDED.type;

  INSERT INTO public.assignments (id, course_id, content_item_id, title, description, instructions, points, due_date, is_published, submission_types)
  VALUES (
    v_assignment_id, v_course_id, v_item_id,
    'E2E Fixture Assignment',
    'Seeded assignment backing the grading and submission journeys.',
    'Submit a short written response. Seeded for E2E; safe to leave in place.',
    100, now() + interval '30 days', true, ARRAY['online_text_entry']
  )
  ON CONFLICT (id) DO UPDATE
  SET is_published = true,
      course_id = EXCLUDED.course_id,
      content_item_id = EXCLUDED.content_item_id,
      points = EXCLUDED.points;

  -- Must end up submitted-but-ungraded every time the seed runs. A previous run
  -- (or a manual click through the SpeedGrader) will have graded this row, and
  -- the unique key is (assignment_id, user_id, attempt) — so DO NOTHING would
  -- silently leave it graded and the fixture would stop supplying the pending
  -- item it promises. Reset the grading fields explicitly on conflict.
  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.assignment_submissions
      (assignment_id, user_id, submitted_at, submission_type, body, workflow_state, attempt)
    VALUES (
      v_assignment_id, v_member_id, now(), 'online_text_entry',
      'Seeded E2E submission body.', 'submitted', 1
    )
    ON CONFLICT (assignment_id, user_id, attempt) DO UPDATE
    SET workflow_state = 'submitted',
        submitted_at = now(),
        submission_type = 'online_text_entry',
        body = EXCLUDED.body,
        grade = NULL,
        score = NULL,
        graded_at = NULL,
        grader_comments = NULL,
        rubric_scores = NULL,
        excused = false,
        missing = false;
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

  -- Assert the exact state the grading specs need, not merely that some row
  -- exists: published assignment, linked to a published content item (else the
  -- dashboard shows "No submissions target" instead of a Grade submissions
  -- link), with a submitted-and-ungraded submission to open in the SpeedGrader.
  SELECT EXISTS (
    SELECT 1
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.content_items ci ON ci.id = a.content_item_id
    WHERE a.id = 'aa0e8400-e29b-41d4-a716-446655440001'
      AND a.is_published
      AND ci.published
      AND s.workflow_state = 'submitted'
      AND s.grade IS NULL
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture assignment aa0e8400-...0001 must be published, linked to a published content item, and carry a submitted/ungraded submission; without all four the grading dashboard renders no Grade submissions link';
  END IF;

  -- The profile certificate, asserted by verification_code on the course it is
  -- pinned to. Both halves matter: the code is what the profile spec matches
  -- on, and the course is what keeps it out of the certificate-reset specs'
  -- blast radius. If a future edit moves this back onto ...0001, this fails
  -- here rather than as an intermittent "Seed gap" three specs away.
  SELECT EXISTS (
    SELECT 1 FROM public.certificates c
    JOIN auth.users u ON u.id = c.user_id
    WHERE u.email = 'e2e-member@insightscollective.org'
      AND c.verification_code = 'E2EMEMBERCERT'
      AND c.course_id = '660e8400-e29b-41d4-a716-446655440002'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: member certificate E2EMEMBERCERT must exist on course 660e8400-...0002; the profile My Certificates spec matches that exact code, and ...0002 is the only fixture course no other spec deletes certificates from';
  END IF;
END $$;

COMMIT;
