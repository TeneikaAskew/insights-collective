-- ABOUTME: Idempotent seed for deterministic Playwright test fixtures.
-- ABOUTME: Run against the target Supabase project before executing the e2e suite.
-- Usage: psql "$SUPABASE_DB_URL" -f e2e/fixtures/seed.sql
-- Safe to run repeatedly. Uses stable identifiers so tests can reference known rows.
--
-- FIXTURES THAT DECAY — the failure mode this file has produced twice
--
-- "Safe to run repeatedly" is not the same as "keeps meaning the same thing".
-- Two fixtures here worked when written and quietly stopped, and in both cases
-- the specs that depended on them kept reporting green because they sat behind
-- count-guards:
--
--   quizzes.allowed_attempts = 3   consumed by the tests themselves. Every run
--                                  that clicked Start burned one, so it died on
--                                  the fourth run. The page then offered no way
--                                  to begin and the quiz specs asserted nothing.
--
--   events.date = CURRENT_DATE+30  behind ON CONFLICT DO NOTHING, so once the
--                                  row existed the date never re-applied. It
--                                  drifted to April 2025, rendered as a "Past
--                                  Event", and vanished from the Upcoming tab
--                                  the specs search.
--
-- Two rules that follow, for anything added below:
--
--   1. If a value is CONSUMED by running the suite (attempts, quotas, one-shot
--      tokens), the seed must restore it, not just create it once.
--   2. If a value is RELATIVE TO NOW, ON CONFLICT DO NOTHING will freeze it at
--      whatever it was the first time. Add an explicit UPDATE.
--
-- And assert it in the DO block at the end. An assertion is what turns a decayed
-- fixture into a loud seed failure instead of a spec that passes against an
-- empty page.

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

-- 1b. Provision the dedicated "journeys" member.
--
--     Why a second member account exists at all: the destructive completion
--     journeys (certificate-generation, full-completion-sequence) prove
--     auto-issuance from a clean slate, so they delete the acting user's
--     certificate and progressions for the reference course before rebuilding
--     them. Run as the shared member, that mutates state other specs render:
--     the profile "My Certificates" card and the /profile visual snapshot both
--     read the member's certificate list, and the suite is fullyParallel, so
--     the list they see depends on where those journeys happen to be. Pinning
--     the fixture certificate to a different course only moved the problem --
--     the *count* still changed mid-run. Only a different user makes the
--     shared member's certificate set constant.
--
--     It also separates the two specs that grade fixture assignment
--     aa0e8400-...0001: submissions are keyed per (assignment, user), so once
--     the journeys account owns one of them the two stop overwriting each
--     other's grade.
--
--     auth.users is written directly because this project has no service-role
--     key in CI and signup is not exercisable headlessly. Two details are
--     load-bearing: the token columns must be '' rather than NULL (GoTrue
--     scans them into non-nullable Go strings and answers every sign-in with
--     "Database error querying schema"), and the auth.identities row must
--     exist or password grant finds no identity to authenticate against. The
--     profiles row and the 'student' role come from the on_auth_user_created
--     trigger; only the enrollment has to be added here.
DO $$
DECLARE
  v_course_id uuid := '660e8400-e29b-41d4-a716-446655440001';
  v_email text := 'e2e-journeys@insightscollective.org';
  v_password text := NULLIF(current_setting('e2e.password', true), '');
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = v_email;

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new,
      email_change_token_current, email_change, phone_change,
      phone_change_token, reauthentication_token
    ) VALUES (
      v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email,
      extensions.crypt(
        COALESCE(v_password, encode(extensions.gen_random_bytes(24), 'base64')),
        extensions.gen_salt('bf')
      ),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"E2E Journeys","email_verified":true}'::jsonb,
      now(), now(),
      '', '', '', '', '', '', '', ''
    );
  ELSIF v_password IS NOT NULL THEN
    -- Re-apply on every run so a rotated CI secret self-heals.
    UPDATE auth.users
       SET encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
           updated_at = now()
     WHERE id = v_id;
  END IF;

  -- Repair an existing row rather than assuming the create path built it:
  -- any NULL here is a sign-in failure with a misleading error message.
  UPDATE auth.users
     SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
         confirmation_token = COALESCE(confirmation_token, ''),
         recovery_token = COALESCE(recovery_token, ''),
         email_change_token_new = COALESCE(email_change_token_new, ''),
         email_change_token_current = COALESCE(email_change_token_current, ''),
         email_change = COALESCE(email_change, ''),
         phone_change = COALESCE(phone_change, ''),
         phone_change_token = COALESCE(phone_change_token, ''),
         reauthentication_token = COALESCE(reauthentication_token, '')
   WHERE id = v_id;

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  )
  SELECT gen_random_uuid(), v_id, v_id::text, 'email',
         jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
         now(), now(), now()
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = v_id AND provider = 'email'
  );

  INSERT INTO public.enrollments (user_id, course_id)
  VALUES (v_id, v_course_id)
  ON CONFLICT DO NOTHING;

  -- The on_auth_user_created trigger leaves first_name/last_name empty, which
  -- is invisible everywhere else but disqualifies this account from the one
  -- job section 1c gives it: the New Conversation dialog searches
  -- profiles.first_name/last_name (useUsers.ts) and renders the match by name,
  -- so a nameless profile can be neither found nor identified in the list.
  -- "Journeys" is unique across profiles; nothing else matches it.
  UPDATE public.profiles
     SET first_name = 'E2E', last_name = 'Journeys'
   WHERE id = v_id
     AND (COALESCE(first_name, '') = '' OR COALESCE(last_name, '') = '');
END $$;

-- 1c. Clear the member <-> journeys one-on-one conversation, so the spec that
--     STARTS a conversation actually starts one.
--
--     Starting a conversation had been failing in production against a trigger
--     that requires conversations.course_id, and nothing caught it: the only
--     spec touching the flow opened the dialog and clicked Cancel. The spec
--     that now submits it can only stay honest if the create path really runs.
--
--     It would not. The dialog calls getOrCreateOneOnOneConversation, so the
--     first run creates and every run afterwards finds. Worse, the finding is
--     invisible from the outside — both paths land on the same conversation
--     view — so the spec would keep passing while the code it exists to cover
--     went untouched, which is precisely the illusory green this suite has
--     been cleaning up.
--
--     Deleting the row here is what keeps it real. It is a hard delete, not
--     the participant-level soft delete the UI performs, because
--     find_one_on_one_conversation (a) ignores conversation_participants
--     .deleted_at entirely and (b) matches on conversations.deleted_at, so
--     anything short of removing the row leaves the pair still "taken".
--
--     WHY THIS PAIR AND NOT THE MEMBER AND THE INSTRUCTOR.
--     journeys/messaging-notifications-hardening.spec.ts drives
--     open_course_thread on the member/instructor pair, and the suite is
--     fullyParallel. Sharing that pair would race: whichever spec ran first
--     would leave a conversation behind and the other would silently take the
--     find branch — the failure this section exists to prevent, reintroduced
--     through parallelism instead of persistence.
--
--     Scoped to exactly this pair. Every other conversation in the database,
--     including the member's own with the instructor, is left alone.
DO $$
DECLARE
  v_member_id uuid;
  v_journeys_id uuid;
  v_ids uuid[];
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org');
  SELECT id INTO v_journeys_id FROM auth.users
   WHERE email = 'e2e-journeys@insightscollective.org';

  IF v_member_id IS NULL OR v_journeys_id IS NULL THEN
    RETURN;
  END IF;

  -- Same shape as find_one_on_one_conversation: not a group, exactly the two
  -- of them. A conversation that merely includes both is somebody else's.
  SELECT array_agg(c.id) INTO v_ids
  FROM public.conversations c
  WHERE c.is_group = false
    AND EXISTS (SELECT 1 FROM public.conversation_participants p
                 WHERE p.conversation_id = c.id AND p.user_id = v_member_id)
    AND EXISTS (SELECT 1 FROM public.conversation_participants p
                 WHERE p.conversation_id = c.id AND p.user_id = v_journeys_id)
    AND (SELECT count(*) FROM public.conversation_participants p
          WHERE p.conversation_id = c.id) = 2;

  IF v_ids IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.messages WHERE conversation_id = ANY(v_ids);
  DELETE FROM public.conversation_participants WHERE conversation_id = ANY(v_ids);
  DELETE FROM public.conversations WHERE id = ANY(v_ids);
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
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org');
  IF v_member_id IS NULL THEN
    RETURN;
  END IF;

  -- Update-then-insert rather than ON CONFLICT. certificates has NO unique
  -- constraint on (user_id, course_id), so `ON CONFLICT (user_id, course_id)`
  -- raised "there is no unique or exclusion constraint matching the ON CONFLICT
  -- specification" — and because this script runs inside BEGIN..COMMIT, that
  -- error aborted the ENTIRE transaction. Every section rolled back, so the
  -- seed had never actually applied: no member certificate, no fixture event,
  -- no invariant checks. The only visible symptom was one spec reporting a
  -- "seed gap".
  --
  -- Adding the constraint would fix the syntax, but certificate_type exists
  -- precisely so a user can hold more than one kind of certificate for a
  -- course; a (user_id, course_id) unique constraint would forbid that
  -- forever to satisfy a test fixture. Scope the idempotency to the row this
  -- fixture owns instead, and leave the schema alone.
  UPDATE public.certificates
     SET verification_code = 'E2EMEMBERCERT',
         certificate_data  = jsonb_build_object(
           'completion_percentage', 100, 'total_items', 11,
           'auto_issued', false, 'seeded_for', 'e2e')
   WHERE user_id = v_member_id
     AND course_id = v_course_id
     AND certificate_type = 'completion';

  IF NOT FOUND THEN
    INSERT INTO public.certificates (user_id, course_id, certificate_type, certificate_data, verification_code, issued_at)
    VALUES (
      v_member_id, v_course_id, 'completion',
      jsonb_build_object('completion_percentage', 100, 'total_items', 11, 'auto_issued', false, 'seeded_for', 'e2e'),
      'E2EMEMBERCERT', now()
    );
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

-- Keep it in the FUTURE. The insert above says CURRENT_DATE + 30, but it is ON
-- CONFLICT DO NOTHING, so once the row existed the date was never revised again
-- — and it had drifted to April 2025, rendering as a "Past Event". A fixture
-- that silently ages out of its own category is the same class of problem as
-- the quiz that consumed its own attempts: it works until it doesn't, and the
-- specs that depend on it fail for a reason unrelated to what they test.
--
-- The events list filters Upcoming vs Past, so an aged-out fixture also means
-- searching the Upcoming tab for it finds nothing.
UPDATE public.events
   SET date = CURRENT_DATE + 30
 WHERE id = 'dd0e8400-e29b-41d4-a716-446655440001'
   AND (date IS NULL OR date <= CURRENT_DATE);

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

-- The fixture quiz shipped with allowed_attempts = 3, which made it a
-- SELF-CONSUMING fixture: every run of quiz-taking.spec.ts that clicked Start
-- burned one, and after the third the page stopped offering a way to begin.
-- Measured before this line existed: allowed_attempts 3, member attempts 3, so
-- the quiz had been un-startable for some time and the count-guards in that
-- spec reported it as passing.
--
-- Raised rather than deleting the member's quiz_submissions, which is the other
-- way to free an attempt: quiz-results.spec.ts and quiz-completion-flow.spec.ts
-- both render those rows, so clearing them would fix this spec by emptying two
-- others. An explicit UPDATE, because the INSERT above is ON CONFLICT DO
-- NOTHING and would never revise an existing row.
UPDATE public.quizzes
   SET allowed_attempts = 9999
 WHERE id = 'bbbb2222-2222-2222-2222-222222222222'
   AND (allowed_attempts IS NULL OR allowed_attempts < 9999);

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

-- Portfolio page for /portfolio/edit/:pageId AND the public view at
-- /portfolio/e2e-member. Owned by the member, because the editor checks
-- ownership — pointing the default at a real user's page would both fail and
-- put a test one keystroke away from editing live content.
--
-- UPSERTED, not ON CONFLICT DO NOTHING. This page is opened by the EDITOR
-- specs, so its title, description and skills are one save away from being
-- something else, permanently — and public-portfolio.spec.ts now asserts that
-- exact content rather than "the page is non-empty". Under DO NOTHING the row
-- would keep whatever an editor run left behind while the seed reported
-- success, which is rule 1 at the top of this file.
--
-- is_public and custom_url are restored for the same reason: flipping either
-- one takes the public route to "Portfolio not found" without touching a row
-- the old ownership-only assertion looked at.
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
    ON CONFLICT (id) DO UPDATE
      SET user_id      = EXCLUDED.user_id,
          title        = EXCLUDED.title,
          description  = EXCLUDED.description,
          theme        = EXCLUDED.theme,
          is_public    = EXCLUDED.is_public,
          custom_url   = EXCLUDED.custom_url,
          layout       = EXCLUDED.layout,
          profile_data = EXCLUDED.profile_data;
  END IF;
END $$;

-- Form for /admin/surveys/:formId/edit.
INSERT INTO public.forms (id, title, description, status, form_link, slug, form_structure)
VALUES ('aaab7777-7777-7777-7777-777777777777',
        'E2E Fixture Survey', 'Fixture survey for the admin survey-editor spec.',
        true, '/survey/e2e-fixture-survey', 'e2e-fixture-survey',
        '{"fields":[{"id":"q1","type":"text","label":"What did you think?"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Assignment offering ALL THREE submission types, for the submission-page specs.
--
-- The production assignment those specs deep-linked to (19d80f57-…) offers
-- file_upload ONLY, so the Text Entry and Website URL tabs correctly never
-- rendered — and every assertion about them sat behind a count-guard that
-- passed on their absence. The tests read as covering three submission types
-- while covering none of them.
--
-- Its module_id is also 770e8400-…0002 while the route helper defaults the
-- module segment to …0001. That mismatch is harmless for loading (the page
-- fetches by content_item_id and uses the module only for its "Back to Module"
-- link) but it means the link pointed at a module the assignment is not in.
-- This fixture puts both in …0001 so the back-link is correct too.
INSERT INTO public.content_items (id, course_id, module_id, type, title, content, position, published)
VALUES ('cccc3333-3333-3333-3333-333333333333',
        '660e8400-e29b-41d4-a716-446655440001',
        '770e8400-e29b-41d4-a716-446655440001',
        'assignment', 'Submission Formats Exercise',
        '<p>Submit your work in whichever format suits it best.</p>', 98, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assignments (id, course_id, module_id, content_item_id, title, description,
                                instructions, points, submission_types, is_published)
VALUES ('cccc4444-4444-4444-4444-444444444444',
        '660e8400-e29b-41d4-a716-446655440001',
        '770e8400-e29b-41d4-a716-446655440001',
        'cccc3333-3333-3333-3333-333333333333',
        'Submission Formats Exercise',
        'Exercises every submission type the page can render.',
        'Pick a tab and submit.', 100,
        ARRAY['online_text_entry', 'online_url', 'online_upload'], true)
ON CONFLICT (id) DO NOTHING;

-- A SUBMITTED assignment for the SpeedGrader to grade.
--
-- Without one, /courses/:id/assignments/:item/grade renders its shell and the
-- three tabs read "Needs (0) / Graded (0) / All (0)" — so the grade input, the
-- feedback box and the Save control legitimately do not exist, and the specs
-- named for them sat behind count-guards reporting that as a pass.
--
-- Attached to the all-types fixture assignment rather than the production one,
-- so grading a fixture never touches a real learner's work. workflow_state is
-- 'submitted' and NOT 'graded': the point is to give the grader something that
-- still needs grading, which is the state the three tests are about.
INSERT INTO public.assignment_submissions
  (id, assignment_id, user_id, submitted_at, submission_type, body, workflow_state, attempt)
SELECT 'cccc5555-5555-5555-5555-555555555555',
       'cccc4444-4444-4444-4444-444444444444',
       u.id,
       now() - interval '1 day',
       'online_text_entry',
       '<p>Fixture submission for the grading interface specs.</p>',
       'submitted',
       1
FROM auth.users u
WHERE u.email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org')
ON CONFLICT (id) DO NOTHING;

-- Two uploaded files on that fixture submission, so the grader's "Uploaded
-- files" panel (SubmissionAttachments) has something real to list, preview and
-- download in e2e/assignments/submission-attachments.spec.ts. Without these the
-- panel renders NOTHING at all (attachments.length === 0 returns null), which
-- is indistinguishable from the component being broken.
--
-- One image and one PDF on purpose: the panel previews images with <img> and
-- PDFs with <iframe>, and those are separate code paths.
--
-- The `url` column holds the storage OBJECT PATH, not a URL — the bucket is
-- private and every read is signed at click time. The path layout is
-- load-bearing: storage policies parse submissions/<courseId>/<userId>/<file>
-- with split_part(). The objects themselves are uploaded by
-- scripts/e2e/seed-submission-files.mjs (SQL cannot write to storage); the spec
-- asserts loudly if they are missing rather than passing on an empty preview.
INSERT INTO public.submission_attachments
  (id, submission_id, filename, content_type, size, url, created_at)
SELECT v.id, 'cccc5555-5555-5555-5555-555555555555', v.filename, v.content_type, v.size,
       'submissions/660e8400-e29b-41d4-a716-446655440001/' || u.id || '/' || v.filename,
       now() - interval '1 day'
FROM auth.users u
CROSS JOIN (VALUES
  ('cccc6666-6666-6666-6666-666666666661'::uuid, 'e2e-fixture-chart.png', 'image/png', 6234),
  ('cccc6666-6666-6666-6666-666666666662'::uuid, 'e2e-fixture-writeup.pdf', 'application/pdf', 1843)
) AS v(id, filename, content_type, size)
WHERE u.email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org')
ON CONFLICT (id) DO NOTHING;



-- The survey the survey specs deep-link to.
--
-- /survey/e2e-fixture-survey rendered "Form Not Found", and the reason was not
-- a missing row: the form exists and is active. Its form_structure was written
-- in the OLD FLAT SHAPE — { "fields": [...] } — while SurveyPage reads
-- { "sections": [ { id, title, fields: [...] } ] } and derives nothing from the
-- flat one. A form that is present, active, and unrenderable.
--
-- So all three survey-page guards were asserting against a not-found screen:
-- fields, submit button and validation alike.
--
-- UPDATE rather than INSERT: forms.slug is UNIQUE, so an insert on this slug
-- fails outright.
--
-- UNCONDITIONAL, and that is the point. The first version only repaired when
-- `sections` was absent or empty, which restores exactly one way this fixture
-- can break. A row edited through the admin form editor — a section renamed, a
-- field removed, a placeholder changed — keeps a non-empty `sections` array, so
-- the repair was skipped, the seed assertion (which counted sections) still
-- passed, and the specs failed on placeholders nobody had touched. That is this
-- file's own rule 1 violated in the act of writing it down: a consumed or
-- edited fixture value must be RESTORED, not merely checked for presence.
-- The written value is deterministic, so running it every time is idempotent.
UPDATE public.forms
   SET status = true,
       title = 'E2E Fixture Survey',
       form_link = '/survey/e2e-fixture-survey',
       form_structure = jsonb_build_object(
         'sections', jsonb_build_array(
           jsonb_build_object(
             'id', 'dddd7777-7777-7777-7777-777777777777',
             'title', 'About you',
             -- No 'placeholder' key on purpose: SurveyField ignores one and
             -- renders `Enter ${label.toLowerCase()}` (SurveyField.tsx:340,361).
             -- A placeholder written here would look load-bearing and change
             -- nothing on screen, so the LABEL is what the specs match on.
             'fields', jsonb_build_array(
               jsonb_build_object('type', 'text', 'label', 'Your name',
                                  'required', true),
               jsonb_build_object('type', 'textarea', 'label', 'What are you hoping to learn?',
                                  'required', false)
             )
           )
         )
       )
 WHERE slug = 'e2e-fixture-survey';

-- The blog post the blog-post specs deep-link to.
--
-- Routes.blogSlug defaults to 'test-blog-post' and NO SUCH ROW EXISTS, so
-- /blog/test-blog-post has been rendering "Blog post not found" — an <h1>, a
-- "Back to Blog" button, and nothing else. Every assertion in
-- blog-post.spec.ts was therefore describing the not-found screen: the title
-- test passed on the words "Blog post not found", and the two count-guards sat
-- on locators for an article and a back link that the real page has and the
-- not-found page mostly does not.
--
-- Seeded rather than repointed at one of the ten real published posts. Those
-- belong to the site owner and can be retitled, unpublished or deleted at any
-- time, which is a fixture that decays by design.
--
-- author_id is NOT NULL, so the post is attributed to the e2e member. If that
-- account is missing the whole seed has already failed further up.
DO $$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org');

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'E2E SEED FAILED: no e2e member account, so the fixture blog post cannot be attributed';
  END IF;

  -- Upserted on the slug, not INSERT ... ON CONFLICT DO NOTHING: a post whose
  -- status was flipped to draft, or whose body was emptied, would otherwise
  -- stay broken forever while the seed reported success. Same rule as the
  -- survey fixture above.
  INSERT INTO public.blog_posts (id, slug, title, excerpt, content, author_id,
                                 status, published_at, read_time)
  VALUES ('eeee8888-8888-8888-8888-888888888888',
          'test-blog-post',
          'E2E Fixture Blog Post',
          'Fixture post for the blog-post specs.',
          E'This paragraph exists so the article body is not empty.\n\n'
          'A second paragraph, so content assertions have something to match.',
          v_member_id,
          'published', now() - interval '1 day', 3)
  ON CONFLICT (slug) DO UPDATE
    SET title        = EXCLUDED.title,
        excerpt      = EXCLUDED.excerpt,
        content      = EXCLUDED.content,
        status       = EXCLUDED.status,
        published_at = COALESCE(public.blog_posts.published_at, EXCLUDED.published_at);
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

  -- A survey the public page cannot load is a survey no spec can test.
  --
  -- Asserted at the EXACT shape survey-page.spec.ts reads, not at
  -- "sections is non-empty". The weaker form passes on any structure with one
  -- section in it — including one whose title and fields have been edited out
  -- from under the specs — so it would have reported a healthy fixture while
  -- every placeholder assertion failed. The seed's job is to make the failure
  -- name its own cause.
  SELECT EXISTS (
    SELECT 1 FROM public.forms
     WHERE slug = 'e2e-fixture-survey'
       AND status = true
       AND title = 'E2E Fixture Survey'
       AND form_structure -> 'sections' -> 0 ->> 'title' = 'About you'
       AND form_structure -> 'sections' -> 0 -> 'fields' -> 0 ->> 'label' = 'Your name'
       AND (form_structure -> 'sections' -> 0 -> 'fields' -> 0 ->> 'required')::boolean IS TRUE
       AND form_structure -> 'sections' -> 0 -> 'fields' -> 1 ->> 'label' = 'What are you hoping to learn?'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: form e2e-fixture-survey is missing, inactive, or no longer matches the structure survey-page.spec.ts asserts (section "About you" with a required "Your name" text field and a "What are you hoping to learn?" textarea)';
  END IF;

  -- Unpublished or empty, /blog/test-blog-post falls back to "Blog post not
  -- found" and blog-post.spec.ts silently describes that screen instead.
  SELECT EXISTS (
    SELECT 1 FROM public.blog_posts
     WHERE slug = 'test-blog-post'
       AND status = 'published'
       AND title = 'E2E Fixture Blog Post'
       AND length(content) > 0
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: no published blog post at slug test-blog-post titled "E2E Fixture Blog Post"; /blog/test-blog-post renders "Blog post not found" and blog-post.spec.ts asserts against it';
  END IF;

  -- An event that has aged into the past is invisible on the Upcoming tab, so
  -- every spec that searches for it there fails for the wrong reason.
  SELECT EXISTS (
    SELECT 1 FROM public.events
     WHERE id = 'dd0e8400-e29b-41d4-a716-446655440001'
       AND date > CURRENT_DATE
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture event dd0e8400-...0001 is not in the future; it renders as a Past Event and the events specs cannot find it';
  END IF;

  -- A grader with nothing to grade renders no grade input, no feedback box and
  -- no Save control, which is exactly what the count-guards were hiding.
  SELECT EXISTS (
    SELECT 1 FROM public.assignment_submissions
     WHERE id = 'cccc5555-5555-5555-5555-555555555555'
       AND workflow_state = 'submitted'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture submission cccc5555-...5555 missing or already graded; grading-interface.spec.ts would assert against an empty SpeedGrader';
  END IF;

  -- A quiz nobody can start is a quiz no spec can test.
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes q
     WHERE q.id = 'bbbb2222-2222-2222-2222-222222222222'
       AND q.allowed_attempts >= 9999
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture quiz bbbb2222-...2222 has a low allowed_attempts; it will exhaust itself and quiz-taking.spec.ts will find no Start button';
  END IF;

  -- All three tabs, or the submission-page specs are back to asserting on UI
  -- that is legitimately absent.
  SELECT EXISTS (
    SELECT 1 FROM public.assignments
     WHERE content_item_id = 'cccc3333-3333-3333-3333-333333333333'
       AND submission_types @> ARRAY['online_text_entry', 'online_url', 'online_upload']
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture assignment cccc3333-...3333 missing or not offering all three submission types; the submission-page tab specs would assert against tabs that never render';
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
      AND u.email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org')
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

  -- Ownership is what the EDITOR needs; the rest is what the PUBLIC view needs.
  -- Checking ownership alone passed on a page whose title, skills or public
  -- flag an editor run had changed, which public-portfolio.spec.ts now asserts
  -- verbatim.
  SELECT EXISTS (
    SELECT 1 FROM public.portfolio_pages p
    JOIN auth.users u ON u.id = p.user_id
     WHERE p.id = 'ffff6666-6666-6666-6666-666666666666'
       AND u.email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org')
       AND p.title = 'E2E Portfolio'
       AND p.description = 'Fixture portfolio page for the editor spec.'
       AND p.is_public IS TRUE
       AND p.custom_url = 'e2e-member'
       AND p.profile_data -> 'skills' ? 'SQL'
       AND p.profile_data -> 'skills' ? 'Python'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture portfolio page missing, not owned by the member, no longer public at /portfolio/e2e-member, or no longer carrying the title/description/skills public-portfolio.spec.ts asserts';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.forms WHERE id = 'aaab7777-7777-7777-7777-777777777777'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: fixture survey form missing; the admin survey editor has nothing to open';
  END IF;
  -- The journeys account must be usable, or every spec retargeted onto it
  -- fails at sign-in with an error that points at global-setup instead of here.
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
    JOIN public.enrollments e
      ON e.user_id = u.id AND e.course_id = '660e8400-e29b-41d4-a716-446655440001'
    WHERE u.email = 'e2e-journeys@insightscollective.org'
      AND u.email_confirmed_at IS NOT NULL
      AND u.confirmation_token IS NOT NULL
      AND u.encrypted_password IS NOT NULL
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: e2e-journeys@insightscollective.org must exist confirmed, with an email identity, non-NULL auth token columns, and an enrollment on course 660e8400-...0001';
  END IF;

  -- The preconditions e2e/messaging/new-conversation.spec.ts cannot check for
  -- itself, because failing any one of them leaves it passing, or failing, for
  -- the wrong reason.
  --
  -- A shared course: without one the Edge Function refuses by design, and the
  -- spec would be reading a legitimate refusal as a bug.
  SELECT EXISTS (
    SELECT 1 FROM public.courses_shared_by_users(ARRAY[
      (SELECT id FROM auth.users
        WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org')),
      (SELECT id FROM auth.users WHERE email = 'e2e-journeys@insightscollective.org')
    ])
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: the member and e2e-journeys share no course, so starting a conversation between them is refused by design and new-conversation.spec.ts cannot pass honestly';
  END IF;

  -- No existing conversation: with one the dialog silently takes the FIND
  -- branch, lands on the same screen, and covers none of the create path.
  SELECT NOT EXISTS (
    SELECT 1 FROM public.find_one_on_one_conversation(
      (SELECT id FROM auth.users
        WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org')),
      (SELECT id FROM auth.users WHERE email = 'e2e-journeys@insightscollective.org')
    )
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: a member <-> e2e-journeys conversation still exists after section 1c, so new-conversation.spec.ts would exercise the find path and pass without touching creation';
  END IF;

  -- A name to search for: useUsers queries profiles.first_name/last_name, and
  -- the on_auth_user_created trigger leaves both empty.
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email = 'e2e-journeys@insightscollective.org'
      AND p.last_name = 'Journeys'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: the e2e-journeys profile has no "Journeys" surname, so the New Conversation search cannot find it';
  END IF;

  -- And the acting account must be allowed to SEE that profile. Both are
  -- students on the reference course, which only grants sight of one another
  -- once migration 20260802140000 is applied. Asserting it here means a
  -- database missing that migration says so, instead of the spec reporting that
  -- it could not find the user and sending the next reader to the search box.
  SELECT public.can_view_profile(
    (SELECT id FROM auth.users
      WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org')),
    (SELECT id FROM auth.users WHERE email = 'e2e-journeys@insightscollective.org')
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: can_view_profile denies the member sight of e2e-journeys — apply migration 20260802140000, which lets people on the same course see each other';
  END IF;

  -- The notification pool is asserted after section 6 writes it, not here. See
  -- the block that follows section 6 for why.
END $$;

-- 6. Notifications for the member, so the notifications specs have something to
--    act on.
--
-- THIS FIXTURE IS CONSUMED BY THE SUITE, so it follows rule 1 at the top of this
-- file: restore, do not merely create. journeys/notifications-flow.spec.ts
-- deletes one row per run to prove the delete persists. The account started with
-- 36 ambient rows and ran dry, at which point that spec failed on its own
-- "Seed gap" assertion — correctly, and with nothing to reseed it.
--
-- Fixed ids are what make the restore work: a deleted row is recreated by the
-- next seed run because ON CONFLICT keys on the id, not on the content.
--
-- Not sourced from a course announcement, deliberately. The announcement
-- fan-out trigger writes one notification per ENROLLED user, and the reference
-- course carries thirteen real accounts alongside the two test ones — that path
-- is how 4,089 probe rows reached fourteen people's inboxes. These rows are
-- written straight to the member and touch nobody else.
DO $$
DECLARE
  v_member_id uuid;
  v_course_id uuid := '660e8400-e29b-41d4-a716-446655440001';
  i int;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org');
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'E2E SEED FAILED: no e2e member account, so the notification fixtures cannot be attributed';
  END IF;

  FOR i IN 1..12 LOOP
    INSERT INTO public.notifications (id, user_id, title, message, type, link, is_read, course_id, created_at)
    VALUES (
      ('77e8a400-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      v_member_id,
      'Fixture notification ' || i,
      'Seeded by e2e/fixtures/seed.sql for the notifications specs.',
      'course_announcement',
      '/courses/' || v_course_id || '/announcements',
      -- A mix, so "Mark all as read" has unread rows to clear and the Unread tab
      -- is not empty. The spec handles both states, but only one exercises the
      -- write.
      (i % 3 = 0),
      v_course_id,
      now() - (i || ' hours')::interval
    )
    ON CONFLICT (id) DO UPDATE
      -- Rule 1 again: is_read is consumed too. "Mark all as read" flips every
      -- unread row, so without this the pool is permanently read after one run
      -- and that spec asserts the disabled-button branch forever.
      SET is_read = (i % 3 = 0),
          created_at = now() - (i || ' hours')::interval;
  END LOOP;
END $$;

-- 6b. The pool section 6 has just written, asserted because the suite consumes
--     it: notifications-flow deletes a row per run to prove the delete persists.
--
-- These two checks used to live in the invariant block above section 6, on the
-- reasoning that a shortfall should surface before the spec hits it. That
-- stopped being satisfiable once global-teardown began deleting every
-- notification belonging to the test accounts at the end of each run: by the
-- next seed the member owns none, so the assertion fired before section 6 could
-- restore them, and — because this file is one transaction — took the entire
-- seed down with it. Every run then tested whatever state the database already
-- held, and the workflow reports a seed failure as a warning, so nothing said so.
--
-- A guard has to describe what the seed produced, not what it inherited.
DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT count(*) >= 10 FROM public.notifications
   WHERE user_id = (SELECT id FROM auth.users
                     WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org'))
   INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: the member has fewer than 10 notifications, so notifications-flow.spec.ts has nothing to open, mark read or delete';
  END IF;

  -- And unread ones specifically: "Mark all as read" only exercises the write
  -- when something is unread, and otherwise passes on the disabled-button path.
  SELECT EXISTS (
    SELECT 1 FROM public.notifications
     WHERE is_read = false
       AND user_id = (SELECT id FROM auth.users
                       WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org'))
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: the member has no unread notifications, so "Mark all as read" asserts the disabled branch and never tests the update';
  END IF;
END $$;

-- 7. An isolated course for the announcement fan-out probe.
--
-- messaging-notifications-hardening.spec.ts inserts a real announcement to
-- prove notify_enrolled_on_announcement writes rows the recipient can see. That
-- trigger fans out to EVERY enrolled user, and the spec had been pointed at the
-- reference course — published, fifteen enrollments, thirteen of them real and
-- demo accounts. RLS lets the spec delete only its own notification, so the rest
-- accumulated: 4,089 rows across 14 inboxes before anyone noticed.
--
-- Migration 20260810000000 now clears the fan-out when the announcement is
-- deleted, which fixes it for everyone. This course is the second layer: even a
-- run that dies before its cleanup can only ever touch test accounts.
--
-- Unpublished on purpose — it exists to receive one announcement, and has no
-- business in the catalogue or in anyone's course list.
DO $$
DECLARE
  v_course_id uuid := '660e8400-e29b-41d4-a716-4466554409e2';
  v_instructor_id uuid;
  v_member_id uuid;
BEGIN
  SELECT id INTO v_instructor_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.instructor_email', true), 'e2e-instructor@insightscollective.org');
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org');
  IF v_instructor_id IS NULL OR v_member_id IS NULL THEN
    RAISE EXCEPTION 'E2E SEED FAILED: the e2e instructor or member account is missing, so the isolated announcement course cannot be built';
  END IF;

  INSERT INTO public.courses (id, title, description, category, level, published, instructor_id)
  VALUES (
    v_course_id,
    'E2E Announcement Probe (test fixture)',
    'Isolated course for the announcement fan-out probe. Not for humans.',
    'analytics',
    'beginner',
    false,
    v_instructor_id
  )
  ON CONFLICT (id) DO UPDATE
    SET published = false,            -- never let it drift into the catalogue
        instructor_id = v_instructor_id;

  INSERT INTO public.enrollments (user_id, course_id, completion_status)
  VALUES (v_member_id, v_course_id, 0)
  ON CONFLICT DO NOTHING;
END $$;

-- 8. Career quiz attempts for the member: one scored, and a newer one that
--    scored nothing.
--
-- This pair reproduces exactly what a real account holds. Opening the career
-- coach from the profile used to write an attempt from whatever scores it was
-- handed, and the profile handed it an empty object whenever localStorage had
-- been cleared — so accounts carry attempts whose four result columns are all
-- 0, stamped later than the genuine one. The profile took strictly the newest
-- row, so that write replaced a real result with three cards reading
-- "Match Score: 0% / Level: Beginner".
--
-- Seeding both rows means career-quiz-results.spec.ts asserts the ordering
-- rule and not merely that some scores render: a regression that goes back to
-- newest-row-wins shows 0% here, exactly as it did in production.
--
-- Fixed ids so re-running restores rather than accumulates.
DO $$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM auth.users
   WHERE email = COALESCE(current_setting('e2e.member_email', true), 'e2e-member@insightscollective.org');
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'E2E SEED FAILED: no e2e member account, so the career quiz attempts cannot be seeded';
  END IF;

  -- The genuine attempt. Analytics 20 of a possible 23 is 87%; Data Engineering
  -- 17 of a possible 19 is 89% and therefore sorts above it once each track is
  -- normalized against its own ceiling rather than a flat 20.
  -- self_reported_experience is the option id from the quiz's experience
  -- question (migration 20260811000000); 'working' maps to Intermediate. Seeded
  -- so the profile spec can assert a recorded level rather than only the
  -- "not recorded" branch that every pre-existing attempt shows.
  INSERT INTO public.career_quiz_attempts (
    id, user_id, session_id, created_at,
    result_ai_ml_score, result_analytics_score,
    result_data_engineering_score, result_business_intelligence_score,
    top_recommended_path, self_reported_experience
  ) VALUES (
    '88e8a400-0000-4000-8000-000000000001', v_member_id, 'e2e-seed-scored',
    now() - interval '30 days',
    16, 20, 17, 18, 'Analytics', 'working'
  )
  ON CONFLICT (id) DO UPDATE
    SET result_ai_ml_score = 16,
        result_analytics_score = 20,
        result_data_engineering_score = 17,
        result_business_intelligence_score = 18,
        self_reported_experience = 'working',
        created_at = now() - interval '30 days';

  -- The poisoned one: newer, and scored nothing.
  INSERT INTO public.career_quiz_attempts (
    id, user_id, session_id, created_at,
    result_ai_ml_score, result_analytics_score,
    result_data_engineering_score, result_business_intelligence_score,
    top_recommended_path
  ) VALUES (
    '88e8a400-0000-4000-8000-000000000002', v_member_id, 'e2e-seed-zero',
    now() - interval '1 day',
    0, 0, 0, 0, 'AI/ML'
  )
  ON CONFLICT (id) DO UPDATE
    SET result_ai_ml_score = 0,
        result_analytics_score = 0,
        result_data_engineering_score = 0,
        result_business_intelligence_score = 0,
        created_at = now() - interval '1 day';

  -- Assert the ordering the spec depends on. If the zero row ever stopped being
  -- the newest, the spec would pass without testing the rule it exists for.
  -- Written as IS DISTINCT FROM 0 so an empty table (scalar subquery → NULL)
  -- raises too, rather than slipping through on NULL <> 0 being unknown.
  IF (
    SELECT COALESCE(result_ai_ml_score, 0) + COALESCE(result_analytics_score, 0)
         + COALESCE(result_data_engineering_score, 0) + COALESCE(result_business_intelligence_score, 0)
      FROM public.career_quiz_attempts
     WHERE user_id = v_member_id
     ORDER BY created_at DESC
     LIMIT 1
  ) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'E2E SEED FAILED: the member''s newest career quiz attempt is missing or is not the zero-scored one, so career-quiz-results.spec.ts cannot prove the profile skips it';
  END IF;
END $$;

COMMIT;
