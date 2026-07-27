-- =====================================================================
-- Regression guard: admin authorization must resolve through user_roles
-- =====================================================================
-- has_admin_access() delegates to get_user_roles(), which every admin RLS
-- policy and the AdminGuard/edge-function checks rely on. get_user_roles was
-- historically defined reading profiles.roles (self-writable) and later
-- repointed to the canonical, non-self-writable user_roles table. That
-- repointing is load-bearing and easy to undo by accident with a future
-- CREATE OR REPLACE.
--
-- This DO block runs on migration apply and fails loudly if get_user_roles no
-- longer reads from public.user_roles, so a silent regression to the
-- self-writable source cannot ship unnoticed.

DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_user_roles'
    AND pg_get_function_identity_arguments(p.oid) = '_user_id uuid';

  IF def IS NULL THEN
    RAISE EXCEPTION
      'get_user_roles(_user_id uuid) is missing; admin authorization depends on it';
  END IF;

  IF def !~* 'from\s+public\.user_roles' THEN
    RAISE EXCEPTION
      'get_user_roles no longer reads from public.user_roles; admin authorization would resolve against a non-canonical (possibly self-writable) source. Definition: %',
      def;
  END IF;

  IF def ~* 'from\s+public\.profiles' THEN
    RAISE EXCEPTION
      'get_user_roles reads from public.profiles; roles must come from user_roles only. Definition: %',
      def;
  END IF;

  RAISE NOTICE 'get_user_roles correctly resolves roles from public.user_roles.';
END $$;
