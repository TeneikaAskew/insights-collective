-- ABOUTME: Idempotent seed for deterministic Playwright test fixtures.
-- ABOUTME: Run against the target Supabase project before executing the e2e suite.
-- Usage: psql "$SUPABASE_DB_URL" -v e2e_password="$E2E_TEST_PASSWORD" -f e2e/fixtures/seed.sql
-- Safe to run repeatedly. Uses stable identifiers so tests can reference known rows.

-- The shared e2e password, used to provision the dedicated journeys account
-- below. It is a CI secret and must never be written into this file; CI passes
-- it with -v. Default it to empty so the seed still runs locally without it --
-- the account is then created with an unguessable random password, and
-- global-setup fails loudly on sign-in rather than the suite failing obscurely.
\if :{?e2e_password}
\else
  \set e2e_password ''
\endif

BEGIN;

-- psql does not expand :variables inside dollar-quoted bodies, so hand the
-- password to the DO blocks the same way this file already passes member_email.
SELECT set_config('e2e.password', :'e2e_password', true);

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
--    This sits on the primary fixture course (E2E_TEST_COURSE_ID,
--    660e8400-...0001), and stays safe there only because the specs that
--    delete certificates for that course -- certificate-generation and
--    full-completion-sequence, which prove auto-issuance from a clean slate --
--    now run as the separate journeys account seeded above. RLS lets a user
--    delete only their own certificates, so a different acting user puts this
--    row outside their blast radius entirely.
--
--    An earlier revision instead pinned this to course ...0002 to dodge that
--    race. It fixed the profile spec and broke the /profile visual snapshot:
--    the shared member then held this row *plus* whatever the journeys issued,
--    so the "My Certificates" card rendered a varying number of entries. The
--    certificate set has to be constant, not merely non-empty.
DO $$
DECLARE
  v_course_id uuid := '660e8400-e29b-41d4-a716-446655440001';
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

    -- issued_at is pinned, not now(): the My Certificates card renders it as
    -- "Issued {toLocaleDateString()}", and that text is inside the /profile
    -- visual snapshot. With now() the baseline would match on the day it was
    -- captured and drift the next day -- and only on a database where this row
    -- happened to be recreated, which is the kind of failure that looks random.
    -- Midday UTC so the rendered date is the same calendar day across any
    -- plausible runner timezone (CI runs UTC and sets no timezoneId).
    -- Assigned on update too, so an existing row created by an older revision
    -- of this seed is corrected rather than keeping its original timestamp.
    INSERT INTO public.certificates (user_id, course_id, certificate_type, certificate_data, verification_code, issued_at)
    VALUES (
      v_member_id, v_course_id, 'completion',
      jsonb_build_object('completion_percentage', 100, 'total_items', 11, 'auto_issued', false, 'seeded_for', 'e2e'),
      'E2EMEMBERCERT', timestamptz '2026-07-27 12:00:00+00'
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET verification_code = EXCLUDED.verification_code,
        certificate_data = EXCLUDED.certificate_data,
        issued_at = EXCLUDED.issued_at;
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
  -- pinned to. The code is what the profile spec matches on; the course is
  -- what the /profile visual baseline was captured against.
  SELECT EXISTS (
    SELECT 1 FROM public.certificates c
    JOIN auth.users u ON u.id = c.user_id
    WHERE u.email = 'e2e-member@insightscollective.org'
      AND c.verification_code = 'E2EMEMBERCERT'
      AND c.course_id = '660e8400-e29b-41d4-a716-446655440001'
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: member certificate E2EMEMBERCERT must exist on course 660e8400-...0001; the profile My Certificates spec matches that exact code';
  END IF;

  -- Exactly one, not at least one: the /profile visual snapshot renders this
  -- card, so an extra certificate on the shared member is a pixel diff. A
  -- second row here means some spec issued a certificate as the shared member
  -- instead of the journeys account -- fail now, with the cause named, rather
  -- than as an unexplained visual regression.
  SELECT COUNT(*) = 1 INTO v_ok
    FROM public.certificates c
    JOIN auth.users u ON u.id = c.user_id
   WHERE u.email = 'e2e-member@insightscollective.org';
  IF NOT v_ok THEN
    RAISE EXCEPTION 'E2E SEED FAILED: the shared member must hold exactly one certificate (the E2EMEMBERCERT fixture); the /profile visual snapshot renders that list, so any extra row is a visual diff. Destructive completion journeys belong on e2e-journeys@insightscollective.org';
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
END $$;

COMMIT;
