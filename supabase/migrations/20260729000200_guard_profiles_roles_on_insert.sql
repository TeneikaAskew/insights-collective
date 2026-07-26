-- Make profiles.roles unassignable at INSERT time, not just UPDATE.
--
-- Follow-up to 20260729000000. That migration tried to lock the roles column on
-- INSERT with `REVOKE INSERT (roles) ON public.profiles FROM anon, authenticated`.
-- That REVOKE is a no-op: authenticated/anon hold a *table-level* INSERT grant
-- (relacl `authenticated=arwdDxt`), and a column-level REVOKE cannot subtract a
-- column from a table-level privilege. The column ACL stayed NULL, so the grant
-- was never actually removed.
--
-- profiles.roles is still load-bearing: ~19 RLS policies (blog_*, rubrics,
-- question_banks, course_assignments, course_instructors, audit_logs, ...) read
-- it to grant admin/instructor access. The existing
-- enforce_profiles_roles_immutable trigger reverts unauthorized role changes,
-- but it fires BEFORE UPDATE only. A user with no profile row could therefore
-- INSERT one pre-elevated with roles = '{admin}' and pass every one of those
-- policies.
--
-- In the current flow that window is closed in practice — handle_new_user
-- creates a '{student}' profile for every signup and there is no DELETE policy on
-- profiles, so the row always exists and a second INSERT hits the PK — but that
-- is incidental. This makes the guard explicit: the same function now also runs
-- on INSERT and pins roles to the column default for any caller that is not the
-- service role or an existing admin. handle_new_user already inserts with the
-- default, so the signup path is unchanged.

CREATE OR REPLACE FUNCTION public.enforce_profiles_roles_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text;
  v_is_privileged boolean;
BEGIN
  jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  v_is_privileged :=
    jwt_role = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'::app_role
    );

  IF TG_OP = 'INSERT' THEN
    -- No OLD row to fall back to. Privileged callers may set roles; everyone
    -- else is pinned to the column default so a profile can never be created
    -- already elevated.
    IF NOT v_is_privileged THEN
      NEW.roles := ARRAY['student']::text[];
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: unchanged behavior — revert unauthorized role changes.
  IF NEW.roles IS NOT DISTINCT FROM OLD.roles THEN
    RETURN NEW;
  END IF;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  NEW.roles := OLD.roles;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_profiles_roles_immutable ON public.profiles;
CREATE TRIGGER enforce_profiles_roles_immutable
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profiles_roles_immutable();
