-- ABOUTME: LOCAL STACK ONLY. Makes the three fixed synthetic e2e accounts (admin, instructor, member) from
-- ABOUTME: scripts/local-db/local-preseed.sql sign-in-able by a real GoTrue with the run's synthetic password.
-- Same GoTrue-compatibility rules as the journeys block in e2e/fixtures/seed.sql: token columns '' not NULL,
-- aud/role 'authenticated', a nil instance_id, a confirmed email, and an auth.identities row of provider
-- 'email'. The password comes from the session setting e2e.password (bridged from psql by seed-auth.sh) and
-- is REQUIRED: an empty value aborts instead of leaving an account that global-setup cannot sign in to.
-- Runs after local-preseed.sql (which creates the rows and their user_roles) and before seed.sh.
DO $$
DECLARE
  v_password text := NULLIF(current_setting('e2e.password', true), '');
  r record;
  v_found int := 0;
BEGIN
  IF v_password IS NULL THEN
    RAISE EXCEPTION 'auth-fixtures: e2e.password is empty; set E2E_TEST_PASSWORD';
  END IF;
  FOR r IN
    SELECT * FROM (VALUES
      ('e2e00000-0000-4000-8000-000000000001'::uuid, 'e2e-admin@insightscollective.org',      'E2E', 'Admin'),
      ('e2e00000-0000-4000-8000-000000000002'::uuid, 'e2e-instructor@insightscollective.org', 'E2E', 'Instructor'),
      ('e2e00000-0000-4000-8000-000000000003'::uuid, 'e2e-member@insightscollective.org',     'E2E', 'Member')
    ) AS t(id, email, first_name, last_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = r.id AND email = r.email) THEN
      RAISE EXCEPTION 'auth-fixtures: % (%) missing; apply scripts/local-db/local-preseed.sql first', r.email, r.id;
    END IF;
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
     WHERE id = r.id;
    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    SELECT gen_random_uuid(), r.id, r.id::text, 'email',
           jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
           now(), now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = r.id AND provider = 'email');
    UPDATE public.profiles SET first_name = r.first_name, last_name = r.last_name
     WHERE id = r.id AND (COALESCE(first_name, '') = '' OR COALESCE(last_name, '') = '');
    v_found := v_found + 1;
  END LOOP;
  IF v_found <> 3 THEN RAISE EXCEPTION 'auth-fixtures: expected 3 accounts, prepared %', v_found; END IF;
END $$;
