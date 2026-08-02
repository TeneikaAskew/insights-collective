-- ABOUTME: courses_shared_by_users(p_user_ids) — courses every one of the given
-- ABOUTME: users belongs to, used to scope a new conversation to a course.
--
-- WHY THIS EXISTS
--
-- Two triggers on the messaging tables require it, and neither has a migration
-- in this repo — they were applied to the database directly:
--
--   conversations_require_course        BEFORE INSERT ON conversations
--     -> enforce_conversation_has_course(): raises when course_id IS NULL
--   enforce_conversation_participant_in_course()
--     -> raises unless each participant is enrolled in, teaches, or admins
--        that course
--
-- messages-helper's createConversation inserted with no course_id, so from the
-- moment those triggers went live every attempt to start a conversation failed
-- with a raw Postgres exception. Nothing caught it: the only spec that touched
-- the flow opened the dialog and clicked Cancel without ever submitting.
--
-- Rather than add a course picker to the dialog for a value the server can
-- work out, the Edge Function asks for the courses all participants share and
-- uses the first. This function is that lookup. It satisfies BOTH triggers by
-- construction — a course everyone belongs to is a course every participant
-- passes the participant check for.
--
-- "Belongs to" deliberately means enrolled OR the course's instructor_id OR an
-- instructor via course_instructors, mirroring
-- enforce_conversation_participant_in_course exactly. If the two ever disagree,
-- conversations become creatable that cannot then have participants added,
-- which is the failure this replaces.
--
-- Admins are NOT treated as belonging to every course here, even though the
-- participant trigger lets them into any. Doing so would let an admin start a
-- conversation scoped to a course the other person is not in, and the trigger
-- would then reject that other person — creating the same broken state through
-- a different door.

CREATE OR REPLACE FUNCTION public.courses_shared_by_users(p_user_ids uuid[])
RETURNS TABLE (course_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id
  FROM public.courses c
  WHERE (
    SELECT count(*)
    FROM unnest(p_user_ids) AS u(user_id)
    WHERE EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = c.id AND e.user_id = u.user_id
          )
       OR c.instructor_id = u.user_id
       OR public.is_course_instructor(u.user_id, c.id)
  ) = cardinality(p_user_ids)
  -- Oldest first, so the same set of people deterministically lands in the same
  -- course rather than drifting as courses are added.
  ORDER BY c.created_at;
$$;

COMMENT ON FUNCTION public.courses_shared_by_users(uuid[]) IS
  'Courses that every supplied user belongs to (enrolled, or instructing). Used by messages-helper to scope a new conversation so it satisfies conversations_require_course and enforce_conversation_participant_in_course.';

REVOKE ALL ON FUNCTION public.courses_shared_by_users(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.courses_shared_by_users(uuid[]) TO authenticated, service_role;
