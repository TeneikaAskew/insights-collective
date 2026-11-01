-- ABOUTME: The platform trigger that gives every new auth.users row a public.profiles row. It lives on the auth
-- ABOUTME: schema, so the public-schema snapshot does not carry it; without it no locally seeded account gets a profile.
-- Definition as in supabase/migrations/20250714081853-caa20c87-2403-4fc7-b651-41f82a32c72c.sql (the repo's latest).
\set ON_ERROR_STOP on
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'on_auth_user_created is not installed and enabled on auth.users';
  END IF;
END $$;
