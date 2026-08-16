-- Stop an absent JWT from raising inside two SECURITY DEFINER helpers.
--
-- `current_setting('request.jwt.claims', true)` returns NULL when the setting was
-- never defined, but an EMPTY STRING when it is defined and blank — which is what
-- a direct psql session gets. `''::jsonb` is not NULL, it is a syntax error:
--
--   invalid input syntax for type json
--   DETAIL: The input string ended unexpectedly.
--
-- Raised inside a BEFORE INSERT trigger, that aborts the caller's transaction.
-- e2e/fixtures/seed.sql is one statement short of 1,200 wrapped in a single
-- BEGIN/COMMIT, so the abort at its first assignment_submissions insert rolled
-- back the entire seed — including the enrolments the specs depend on. CI then
-- ran against whatever state the database happened to already hold, and the
-- e2e job reported the seed error as a warning and carried on, so this stayed
-- invisible until an unrelated change removed one of those enrolments.
--
-- NULLIF makes the blank case read as NULL, which is what the code already
-- assumed. This cannot widen access: NULL fails the 'service_role' comparison and
-- falls through to the same auth.uid() lookup an ordinary caller takes. The old
-- behaviour was not stricter, only louder — it raised instead of answering.

CREATE OR REPLACE FUNCTION public.is_grading_staff()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('instructor'::app_role, 'admin'::app_role)
  );
END;
$function$;

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
  jwt_role := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
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
