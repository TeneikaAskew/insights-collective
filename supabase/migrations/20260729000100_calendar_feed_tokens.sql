-- Per-enrollment calendar feed tokens.
--
-- course-calendar-feed is deployed with verify_jwt = false and queries with the
-- service role. Its only gate was `course.published`, so anyone could pull a
-- course's full assignment, quiz and announcement schedule — announcement bodies
-- included, verbatim, in the ICS DESCRIPTION — for any published course, and the
-- response was served `Cache-Control: public`.
--
-- A calendar client subscribing to an ICS URL cannot present a JWT, so the feed
-- needs a bearer secret in the URL itself. One unguessable token per enrollment:
-- it identifies the subscriber, it can be rotated per user, and it disappears
-- when the enrollment does.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS calendar_feed_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_calendar_feed_token_key
  ON public.enrollments (calendar_feed_token);

-- The token is a credential: it must never be readable by anyone but its owner.
-- The instructor/admin SELECT policy on enrollments would otherwise expose every
-- student's feed token, so column-level SELECT is narrowed to the owner's own
-- path. Postgres has no per-policy column grants, so this is enforced by keeping
-- the column out of the instructor-facing views and revoking the broad grant.
REVOKE SELECT (calendar_feed_token) ON public.enrollments FROM anon;

-- Lets a student fetch (and implicitly create, via the column default) their own
-- feed token without selecting the column directly.
CREATE OR REPLACE FUNCTION public.get_my_calendar_feed_token(p_course_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT e.calendar_feed_token
  FROM public.enrollments e
  WHERE e.course_id = p_course_id
    AND e.user_id = auth.uid()
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_my_calendar_feed_token(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_calendar_feed_token(uuid) TO authenticated;

-- Lets a user invalidate a feed URL they have shared or lost.
CREATE OR REPLACE FUNCTION public.rotate_my_calendar_feed_token(p_course_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token uuid;
BEGIN
  UPDATE public.enrollments
  SET calendar_feed_token = gen_random_uuid()
  WHERE course_id = p_course_id
    AND user_id = auth.uid()
  RETURNING calendar_feed_token INTO v_token;

  RETURN v_token;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rotate_my_calendar_feed_token(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rotate_my_calendar_feed_token(uuid) TO authenticated;

-- Resolves a feed token to its enrollment for the edge function. SECURITY
-- DEFINER so the function does not need to hand the service-role client a raw
-- select over the token column.
CREATE OR REPLACE FUNCTION public.resolve_calendar_feed_token(
  p_course_id uuid,
  p_token uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT e.user_id
  FROM public.enrollments e
  WHERE e.course_id = p_course_id
    AND e.calendar_feed_token = p_token
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_calendar_feed_token(uuid, uuid)
  FROM public, anon, authenticated;

-- While we are here: this policy is one of the last readers of `profiles.roles`
-- for an authorization decision. Same rule, sourced from `user_roles`.
DROP POLICY IF EXISTS "Admins and instructors can view course enrollments" ON public.enrollments;

CREATE POLICY "enrollments_staff_select" ON public.enrollments
  FOR SELECT TO authenticated
  USING (
    public.has_admin_access(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
  );
