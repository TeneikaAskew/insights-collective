-- ABOUTME: CANDIDATE (not applied by default): aligns the EXACT quiz-lifecycle learner's auth row with the shared, already
-- ABOUTME: used GoTrue-compatibility rule set of scripts/local-stack/auth-fixtures.sql. Runs only after the OLD probe FAILED.
--
-- Why a candidate and not a fixture.sql edit: the cause of run 41353483766 is NOT established. The auth-gate applies this
-- only when the original seed's probe fails, then probes again, so the two outcomes are separately recorded.
-- Rule set: the SET column list below is the auth-fixtures.sql column list, checked for drift by
-- src/test/ci/checkLearnerAuthGate.test.ts, so this is the shared builder's rules, not a new hand-maintained subset.
-- Scope: exactly one row (id AND email match); refuses otherwise. No identity insert, no delete, no other account touched.
-- The password arrives as the session setting e2e.password (bridged over stdin by learner-auth-align.sh), never in argv.
DO $$
DECLARE
  v_learner  uuid := '9c000000-0000-4000-8000-0000000000a1';
  v_email    text := 'qlc-learner@insightscollective.local';
  v_password text := NULLIF(current_setting('e2e.password', true), '');
  v_n int;
BEGIN
  IF v_password IS NULL THEN RAISE EXCEPTION 'quiz-lifecycle align: e2e.password is empty'; END IF;
  UPDATE auth.users
     SET instance_id = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'),
         aud = 'authenticated',
         role = 'authenticated',
         encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
         email_confirmed_at = COALESCE(email_confirmed_at, now()),
         raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
         raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"email_verified":true}'::jsonb,
         created_at = COALESCE(created_at, now()),
         updated_at = now(),
         confirmation_token = COALESCE(confirmation_token, ''),
         recovery_token = COALESCE(recovery_token, ''),
         email_change_token_new = COALESCE(email_change_token_new, ''),
         email_change_token_current = COALESCE(email_change_token_current, ''),
         email_change = COALESCE(email_change, ''),
         phone_change = COALESCE(phone_change, ''),
         phone_change_token = COALESCE(phone_change_token, ''),
         reauthentication_token = COALESCE(reauthentication_token, '')
   WHERE id = v_learner AND email = v_email;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'quiz-lifecycle align: expected exactly 1 learner row, updated %', v_n; END IF;
  RAISE NOTICE 'quiz-lifecycle align: 1 learner row aligned';
END $$;
