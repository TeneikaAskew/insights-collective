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

-- ── Fixtures for the routes that used to be tested with placeholder IDs ─────
--
-- Nine TestIds defaults in e2e/helpers/route-helpers.ts were non-UUID strings
-- ('test-module-id', 'test-quiz-id', …). Postgres rejects those with 22P02, so
-- eight route builders loaded pages that could never fetch anything: the specs
-- asserted against an error state and passed on generic headings. That noise is
-- also what the two blanket suppressions in console-errors.fixture.ts were
-- compensating for — every /rest/v1/ failure and 110 of the app's 187 logger
-- prefixes — which is how two real 42703 page breaks stayed invisible to the
-- whole suite.
--
-- These rows make the defaults real, so the suppressions can be narrowed to the
-- errors that are genuinely expected.
--
-- IDs are deliberately patterned (aaaa1111…, bbbb2222…) so a row that turns up
-- in a query result is obviously a fixture rather than user data.

-- Quiz the quiz-taking and quiz-results specs deep-link to. The content_item is
-- the routable half; the quiz row is what the page actually loads.
INSERT INTO public.content_items (id, course_id, module_id, type, title, content, position, published)
VALUES ('aaaa1111-1111-1111-1111-111111111111',
        '660e8400-e29b-41d4-a716-446655440001',
        '770e8400-e29b-41d4-a716-446655440001',
        'quiz', 'Foundations Check-in', '', 99, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quizzes (id, content_item_id, module_id, title, description,
                            quiz_type, points_possible, allowed_attempts, show_correct_answers)
VALUES ('bbbb2222-2222-2222-2222-222222222222',
        'aaaa1111-1111-1111-1111-111111111111',
        '770e8400-e29b-41d4-a716-446655440001',
        'Foundations Check-in', 'Weekly foundations check-in',
        'assignment', 20, 3, true)
ON CONFLICT (id) DO NOTHING;

-- Questions need real answers. A question whose choices are empty renders
-- "No options configured for this question" — the page loads but nothing can be
-- answered, so the spec is back to testing an error state.
--
-- Seed the `answers` column, not just `options`. get_quiz_questions_for_taking
-- supports two shapes and prefers the first:
--
--   answers  [{id, text, correct}, …]     ← preferred; what the editor writes
--   options  ["A", "B"] + correct_answer  ← legacy fallback
--
-- Filling only the legacy pair works, but leaves the fixture on a code path the
-- app itself no longer produces, and any row that happens to carry an `answers`
-- value silently wins over it. Seed the preferred shape and mirror it into the
-- legacy columns so both paths describe the same quiz.
--
-- correct_answer is jsonb: `''` would fold to ''::jsonb at parse time, which is
-- the bug that made every quiz on the platform throw 22P02
-- (migration 20260730000000).
INSERT INTO public.quiz_questions (id, quiz_id, question_text, question_type,
                                   answers, options, correct_answer, points, position)
VALUES
  ('db813510-23b3-4954-b211-e0d40d97bc24',
   'bbbb2222-2222-2222-2222-222222222222',
   'Which of these is a supervised learning task?', 'multiple_choice',
   '[{"id":"a1000001-0000-4000-8000-000000000001","text":"Spam classification","correct":true},
     {"id":"a1000001-0000-4000-8000-000000000002","text":"K-means clustering","correct":false},
     {"id":"a1000001-0000-4000-8000-000000000003","text":"Principal component analysis","correct":false},
     {"id":"a1000001-0000-4000-8000-000000000004","text":"Anomaly detection","correct":false}]'::jsonb,
   '["Spam classification","K-means clustering","Principal component analysis","Anomaly detection"]'::jsonb,
   '"Spam classification"'::jsonb, 10, 1),
  ('c636a401-d4d2-498a-a33b-c9c8abcfb294',
   'bbbb2222-2222-2222-2222-222222222222',
   'What does EDA stand for?', 'multiple_choice',
   '[{"id":"a2000002-0000-4000-8000-000000000001","text":"Exploratory Data Analysis","correct":true},
     {"id":"a2000002-0000-4000-8000-000000000002","text":"Extended Data Aggregation","correct":false},
     {"id":"a2000002-0000-4000-8000-000000000003","text":"Enterprise Data Architecture","correct":false},
     {"id":"a2000002-0000-4000-8000-000000000004","text":"Estimated Data Accuracy","correct":false}]'::jsonb,
   '["Exploratory Data Analysis","Extended Data Aggregation","Enterprise Data Architecture","Estimated Data Accuracy"]'::jsonb,
   '"Exploratory Data Analysis"'::jsonb, 10, 2)
ON CONFLICT (id) DO UPDATE
  SET answers = EXCLUDED.answers,
      options = EXCLUDED.options,
      correct_answer = EXCLUDED.correct_answer,
      question_text = EXCLUDED.question_text;

-- A graded attempt, so /quiz-results renders a real score.
--
-- pin_quiz_submission_score() rewrites score to NULL and 'complete' to
-- 'pending_review' for anyone who is not grading staff — a deliberate control so
-- a student cannot POST themselves a grade. The seed does not bypass it; it
-- adopts the instructor's identity for this one statement, which is the identity
-- that would legitimately produce a graded submission. Set LOCAL, so it lasts
-- only for this transaction, and cleared immediately afterwards.
--
-- DO UPDATE rather than DO NOTHING: a spec that submits the quiz leaves the row
-- mid-attempt, and the next run would open a results page for an unfinished one.
DO $$
DECLARE
  v_member_id uuid;
  v_instructor_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org');
  SELECT id INTO v_instructor_id FROM auth.users
   WHERE email = 'e2e-instructor@insightscollective.org';

  IF v_member_id IS NOT NULL AND v_instructor_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_instructor_id, 'role', 'authenticated')::text,
                       true);

    INSERT INTO public.quiz_submissions (id, quiz_id, user_id, attempt, started_at, finished_at,
                                         time_spent, score, kept_score, workflow_state)
    VALUES ('dddd4444-4444-4444-4444-444444444444',
            'bbbb2222-2222-2222-2222-222222222222', v_member_id, 1,
            now() - interval '1 hour', now() - interval '58 minutes', 120, 20, 20, 'complete')
    ON CONFLICT (id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          finished_at = EXCLUDED.finished_at,
          workflow_state = EXCLUDED.workflow_state,
          score = EXCLUDED.score,
          kept_score = EXCLUDED.kept_score;

    PERFORM set_config('request.jwt.claims', '', true);
  END IF;
END $$;

-- Rubric for /courses/:courseId/rubrics/:rubricId/edit. It must live on the
-- reference course: the route builder defaults both segments, and a rubric
-- belonging to a different course renders Not Found.
DO $$
DECLARE
  v_instructor_id uuid;
BEGIN
  SELECT id INTO v_instructor_id FROM auth.users
   WHERE email = 'e2e-instructor@insightscollective.org';
  IF v_instructor_id IS NOT NULL THEN
    INSERT INTO public.rubrics (id, course_id, title, description, points_possible, created_by)
    VALUES ('eeee5555-5555-5555-5555-555555555555',
            '660e8400-e29b-41d4-a716-446655440001',
            'Data Analysis Rubric', 'Fixture rubric for the rubric-editor spec.', 100, v_instructor_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Portfolio page for /portfolio/edit/:pageId. Owned by the member, because the
-- editor checks ownership — pointing the default at a real user's page would
-- both fail and put a test one keystroke away from editing live content.
DO $$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org');
  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.portfolio_pages (id, user_id, title, description, theme, is_public, custom_url, layout, profile_data)
    VALUES ('ffff6666-6666-6666-6666-666666666666', v_member_id,
            'E2E Portfolio', 'Fixture portfolio page for the editor spec.',
            'modern', true, 'e2e-member', 'hero-focus',
            '{"skills":["SQL","Python"],"professional_summary":"Fixture portfolio."}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Form for /admin/surveys/:formId/edit.
INSERT INTO public.forms (id, title, description, status, form_link, slug, form_structure)
VALUES ('aaab7777-7777-7777-7777-777777777777',
        'E2E Fixture Survey', 'Fixture survey for the admin survey-editor spec.',
        true, '/survey/e2e-fixture-survey', 'e2e-fixture-survey',
        '{"fields":[{"id":"q1","type":"text","label":"What did you think?"}]}'::jsonb)
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

  -- The fixtures the route-helper defaults point at. Without each of these the
  -- corresponding spec loads an error state and still passes on generic
  -- headings, which is the false-green this seed exists to prevent.

  SELECT EXISTS (
    SELECT 1 FROM public.content_items
     WHERE id = 'aaaa1111-1111-1111-1111-111111111111'
       AND module_id = '770e8400-e29b-41d4-a716-446655440001'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture quiz content item missing; quiz-taking and quiz-results would test a Not Found page';
  END IF;

  -- Answers, not just the question rows. get_quiz_questions_for_taking reads
  -- `answers` first and falls back to `options`; a question with neither renders
  -- "No options configured for this question" and the quiz is as untakeable as
  -- it was with a placeholder ID. Assert exactly one correct answer per
  -- question too — zero makes the quiz unscoreable, more than one makes the
  -- expected score ambiguous.
  SELECT COUNT(*) = 2 INTO v_ok
    FROM public.quiz_questions q
   WHERE q.quiz_id = 'bbbb2222-2222-2222-2222-222222222222'
     AND jsonb_array_length(COALESCE(q.answers, '[]'::jsonb)) > 0
     AND jsonb_array_length(COALESCE(q.options, '[]'::jsonb)) > 0
     AND q.correct_answer IS NOT NULL
     AND (
       SELECT COUNT(*) FROM jsonb_array_elements(q.answers) a
        WHERE COALESCE((a->>'correct')::boolean, false)
     ) = 1;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture quiz needs 2 questions, each with answers and exactly one marked correct';
  END IF;

  -- Assert the score too, not just the row. pin_quiz_submission_score() nulls
  -- the score for any writer that is not grading staff, so a seed that lost the
  -- instructor identity would still insert a row — one that renders an empty
  -- results page while this check passed.
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_submissions
     WHERE id = 'dddd4444-4444-4444-4444-444444444444'
       AND workflow_state = 'complete'
       AND score IS NOT NULL
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture quiz submission missing, unfinished or ungraded; quiz-results has nothing to render';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.rubrics
     WHERE id = 'eeee5555-5555-5555-5555-555555555555'
       AND course_id = '660e8400-e29b-41d4-a716-446655440001'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture rubric missing from the reference course; the rubric editor renders Not Found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.portfolio_pages p
    JOIN auth.users u ON u.id = p.user_id
     WHERE p.id = 'ffff6666-6666-6666-6666-666666666666'
       AND u.email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org')
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture portfolio page missing or not owned by the member; the editor rejects it';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.forms WHERE id = 'aaab7777-7777-7777-7777-777777777777'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture survey form missing; the admin survey editor has nothing to open';
  END IF;
END $$;

COMMIT;
