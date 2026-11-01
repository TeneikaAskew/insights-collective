-- ABOUTME: LOCAL STACK ONLY. Synthetic fixture for the learner quiz lifecycle mode: one dedicated learner, one course,
-- ABOUTME: one quiz per scenario. Seeds NO quiz_submissions: every attempt is created by the browser via start_quiz_attempt.
--
-- Applied by fixture.sh, after the target guard (assert-safe-target.mjs --mutating), with the run's synthetic password
-- bridged into the session setting e2e.password. Never run against a Supabase project.
--
-- What it does NOT do: no GRANT/REVOKE, no policy or RLS change, no trigger change, no row in quiz_submissions,
-- quiz_submission_answers or content_item_progressions, and no change to the shared admin/instructor/member/journeys
-- accounts. Re-running it is refused when the learner already holds an attempt, so a fixture can never be "reset" by
-- silently reusing a used stack (each mode run starts from a fresh `supabase start`).
--
-- Ids: 9c00…, so a fixture row is recognisable in any query result. Per scenario NN (two hex digits):
--   content item 9c00NN01-…, quiz 9c00NN02-…, questions 9c00NN03-… and 9c00NN04-….
DO $$
DECLARE
  v_password text := NULLIF(current_setting('e2e.password', true), '');
  v_learner  uuid := '9c000000-0000-4000-8000-0000000000a1';
  v_email    text := 'qlc-learner@insightscollective.local';
  v_course   uuid := '9c000000-0000-4000-8000-000000000001';
  v_module   uuid := '9c000000-0000-4000-8000-000000000002';
  r record;
  v_item uuid; v_quiz uuid; v_n int := 0;
BEGIN
  IF v_password IS NULL THEN
    RAISE EXCEPTION 'quiz-lifecycle fixture: e2e.password is empty; set E2E_TEST_PASSWORD';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_submissions WHERE user_id = v_learner) THEN
    RAISE EXCEPTION 'quiz-lifecycle fixture: the learner already holds attempts; this stack is used, start a fresh one';
  END IF;

  -- Dedicated learner, GoTrue-compatible (same rules as scripts/local-stack/auth-fixtures.sql): token columns ''
  -- not NULL, aud/role 'authenticated', nil instance_id, confirmed email, an auth.identities row of provider 'email'.
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (v_learner, v_email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"first_name":"QLC","last_name":"Learner","email_verified":true}')
  ON CONFLICT (id) DO NOTHING;
  UPDATE auth.users
     SET instance_id = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'),
         aud = 'authenticated', role = 'authenticated',
         encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
         email_confirmed_at = COALESCE(email_confirmed_at, now()),
         confirmation_token = COALESCE(confirmation_token, ''),
         recovery_token = COALESCE(recovery_token, ''),
         email_change_token_new = COALESCE(email_change_token_new, ''),
         email_change = COALESCE(email_change, '')
   WHERE id = v_learner AND email = v_email;
  IF NOT FOUND THEN RAISE EXCEPTION 'quiz-lifecycle fixture: learner row % / % not prepared', v_learner, v_email; END IF;
  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), v_learner, v_learner::text, 'email',
         jsonb_build_object('sub', v_learner::text, 'email', v_email, 'email_verified', true), now(), now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_learner AND provider = 'email');
  INSERT INTO public.profiles (id) VALUES (v_learner) ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET first_name = 'QLC', last_name = 'Learner' WHERE id = v_learner;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_learner, 'student') ON CONFLICT DO NOTHING;

  -- Course: unpublished, so it never appears in a catalogue; the learner reaches it through the enrollment.
  INSERT INTO public.courses (id, title, description, category, level, published)
  VALUES (v_course, 'QLC Quiz Lifecycle (test fixture)', 'Synthetic course for the learner quiz lifecycle mode. Not for humans.',
          'analytics', 'beginner', false)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.modules (id, course_id, title, position, published)
  VALUES (v_module, v_course, 'QLC scenarios', 1, true)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.enrollments (user_id, course_id, completion_status)
  SELECT v_learner, v_course, 0
  WHERE NOT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = v_learner AND course_id = v_course);

  -- One quiz per scenario, so no scenario consumes another's attempts. allowed_attempts NULL and 0 are both unlimited.
  FOR r IN
    SELECT * FROM (VALUES
      ('10', 'F1 limit one',        1::int,    NULL::int),
      ('11', 'F2 resume (timed)',   1,         30),
      ('12', 'F3 retake',           2,         NULL),
      ('13', 'F4 unlimited null',   NULL,      NULL),
      ('14', 'F4 unlimited zero',   0,         NULL),
      ('15', 'F5 quiz A',           1,         NULL),
      ('16', 'F5 quiz B',           1,         NULL),
      ('17', 'F6 progress',         1,         NULL),
      ('18', 'U1 uncertain retake', 2,         NULL),
      ('19', 'U2 uncertain submit', 1,         NULL),
      ('1a', 'U3 remount write',    1,         NULL)
    ) AS t(nn, title, allowed, time_limit)
  LOOP
    v_item := ('9c00' || r.nn || '01-0000-4000-8000-000000000000')::uuid;
    v_quiz := ('9c00' || r.nn || '02-0000-4000-8000-000000000000')::uuid;
    INSERT INTO public.content_items (id, course_id, module_id, type, title, content, position, published)
    VALUES (v_item, v_course, v_module, 'quiz', 'QLC ' || r.title, '', v_n + 1, true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.quizzes (id, content_item_id, module_id, title, quiz_type, points_possible,
                                allowed_attempts, time_limit, show_correct_answers)
    VALUES (v_quiz, v_item, v_module, 'QLC ' || r.title, 'assignment', 2, r.allowed, r.time_limit, true)
    ON CONFLICT (id) DO NOTHING;
    -- Explicit, because allowed_attempts has a column default of 1 and NULL must stay NULL.
    UPDATE public.quizzes SET allowed_attempts = r.allowed, time_limit = r.time_limit WHERE id = v_quiz;
    INSERT INTO public.quiz_questions (id, quiz_id, question_text, question_type, answers, options, correct_answer, points, position)
    VALUES
      (('9c00' || r.nn || '03-0000-4000-8000-000000000000')::uuid, v_quiz, r.title || ': Q1 two plus two', 'multiple_choice',
       jsonb_build_array(jsonb_build_object('id', 'qlc-' || r.nn || '-four',  'text', 'Four',  'correct', true),
                         jsonb_build_object('id', 'qlc-' || r.nn || '-three', 'text', 'Three', 'correct', false)),
       '["Four","Three"]'::jsonb, '"Four"'::jsonb, 1, 1),
      (('9c00' || r.nn || '04-0000-4000-8000-000000000000')::uuid, v_quiz, r.title || ': Q2 colour of a clear sky', 'multiple_choice',
       jsonb_build_array(jsonb_build_object('id', 'qlc-' || r.nn || '-red',  'text', 'Red',  'correct', false),
                         jsonb_build_object('id', 'qlc-' || r.nn || '-blue', 'text', 'Blue', 'correct', true)),
       '["Red","Blue"]'::jsonb, '"Blue"'::jsonb, 1, 2)
    ON CONFLICT (id) DO NOTHING;
    v_n := v_n + 1;
  END LOOP;

  IF v_n <> 11 THEN RAISE EXCEPTION 'quiz-lifecycle fixture: expected 11 scenario quizzes, prepared %', v_n; END IF;
  IF (SELECT count(*) FROM public.quizzes WHERE id::text LIKE '9c00%' AND allowed_attempts IS NULL) <> 1
     OR (SELECT count(*) FROM public.quizzes WHERE id::text LIKE '9c00%' AND allowed_attempts = 0) <> 1 THEN
    RAISE EXCEPTION 'quiz-lifecycle fixture: unlimited quizzes (NULL and 0) not prepared exactly once each';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_submissions WHERE user_id = v_learner) THEN
    RAISE EXCEPTION 'quiz-lifecycle fixture: an attempt exists after seeding; nothing here may create one';
  END IF;
  RAISE NOTICE 'quiz-lifecycle fixture: learner, course, % quizzes, 0 attempts', v_n;
END $$;
