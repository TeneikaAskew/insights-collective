-- =====================================================================
-- SECURITY FIX: users must not be able to write their own profiles.roles
-- =====================================================================
--
-- Background
-- ----------
-- 20250714081722 added a guard on the profiles UPDATE policy that pinned the
-- roles column:
--
--   WITH CHECK (auth.uid() = id AND roles = (SELECT roles FROM profiles ...))
--
-- 20251006020000 and 20251006030000 both drop EVERY policy on public.profiles
-- with a dynamic loop over pg_policies, then recreate only:
--
--   USING (auth.uid() = id) WITH CHECK (auth.uid() = id)
--
-- so the roles guard was silently lost. Since profiles.roles is still read for
-- authorization by the admin-users edge function and by a number of older RLS
-- policies (blog, rubrics, question banks, announcements, courses, events), any
-- authenticated user could run
--
--   update profiles set roles = '{admin,student}' where id = auth.uid();
--
-- and gain admin. This migration closes the write path.
--
-- Why not simply restore the old WITH CHECK subquery
-- --------------------------------------------------
-- That subquery selects from profiles inside a policy on profiles, which is
-- what 20251006030000 ("fix_profiles_recursion") was written to undo. Restoring
-- it would reintroduce the recursion it fixed. Instead this uses two mechanisms
-- that are evaluated outside policy expansion and therefore cannot recurse:
--
--   1. Column-level UPDATE privileges (pure Postgres grants, no RLS involved).
--   2. A BEFORE UPDATE trigger that pins the column (belt and braces, and it
--      survives a future GRANT that re-widens the table privilege).
--
-- The RLS policy itself is deliberately left exactly as 20251006030000 wrote it.

-- ---------------------------------------------------------------------
-- 1. Column-level privileges
--    A table-level UPDATE grant implies update on every column, and a
--    column-level REVOKE does not narrow it. So drop the table-level grant and
--    re-grant every column except roles. Built dynamically so the column list
--    cannot drift out of sync with the table.
--    service_role is untouched: it must still maintain the column.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  updatable_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO updatable_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name <> 'roles';

  IF updatable_cols IS NULL THEN
    RAISE EXCEPTION 'public.profiles has no updatable columns; aborting';
  END IF;

  EXECUTE 'REVOKE UPDATE ON public.profiles FROM authenticated';
  EXECUTE 'REVOKE UPDATE ON public.profiles FROM anon';
  EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', updatable_cols);
END $$;

-- ---------------------------------------------------------------------
-- 2. Trigger guard
--    Pins roles to its previous value unless the caller is a real admin
--    (per the canonical user_roles table) or the service role.
--
--    The change is silently reverted rather than raised: clients routinely
--    write back a whole profile row, and a reordered-but-equivalent roles array
--    would otherwise turn an ordinary profile save into a hard error. Reverting
--    preserves the security property without that breakage.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profiles_roles_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  IF NEW.roles IS NOT DISTINCT FROM OLD.roles THEN
    RETURN NEW;
  END IF;

  jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';

  -- The service role maintains this column on behalf of admin-users.
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Genuine admins may change roles. user_roles is the canonical source and is
  -- not self-writable, so this cannot be bootstrapped from the profiles row.
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  ) THEN
    RETURN NEW;
  END IF;

  NEW.roles := OLD.roles;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profiles_roles_immutable ON public.profiles;
CREATE TRIGGER enforce_profiles_roles_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profiles_roles_immutable();

-- ---------------------------------------------------------------------
-- 3. Backfill user_roles from the legacy column
--    admin-users now authorizes via has_admin_access (user_roles), so any role
--    that exists only in profiles.roles would stop being honored.
--
--    'admin' is deliberately NOT backfilled. profiles.roles was self-writable
--    until this migration, so auto-promoting from it would launder an already
--    exploited escalation into the canonical table. Admin mismatches are
--    reported below for manual review instead.
-- ---------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT p.id, r::app_role
FROM public.profiles p
CROSS JOIN LATERAL unnest(p.roles) AS r
WHERE r IN ('student', 'instructor')
ON CONFLICT (user_id, role) DO NOTHING;

DO $$
DECLARE
  orphan_admin record;
  found_any boolean := false;
BEGIN
  FOR orphan_admin IN
    SELECT p.id
    FROM public.profiles p
    WHERE 'admin' = ANY(p.roles)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role
      )
  LOOP
    found_any := true;
    RAISE WARNING 'profiles.roles lists admin for user % but user_roles does not. NOT auto-granted - review and grant explicitly with update_user_roles() if legitimate.', orphan_admin.id;
  END LOOP;

  IF NOT found_any THEN
    RAISE NOTICE 'No profiles-only admin accounts found; user_roles is consistent.';
  END IF;
END $$;

COMMENT ON FUNCTION public.enforce_profiles_roles_immutable IS
  'Pins profiles.roles against self-service modification. user_roles is the canonical role source; profiles.roles is a service-role-maintained mirror kept for legacy RLS policies.';
