-- ABOUTME: Lets people on the same course see each other's profiles, so the
-- ABOUTME: set you can find matches the set you are allowed to message.
--
-- WHY
--
-- Two rules govern who a student can start a conversation with, and they did
-- not agree.
--
--   courses_shared_by_users  — messaging: anyone who shares a course with you
--   can_view_profile         — visibility: yourself, the instructors of courses
--                              you are enrolled in, co-instructors via
--                              course_assignments, people you already share a
--                              conversation with, and admins
--
-- Nothing was broken by the gap, but the reachable set was the intersection:
-- **two students on the same course could not see each other at all**, so the
-- New Conversation dialog invited a search that could never return most of the
-- people the server would have accepted. In practice a student could only ever
-- start a conversation with an instructor.
--
-- This surfaced as a CI failure rather than a report, which is the point of the
-- test that found it: e2e/messaging/new-conversation.spec.ts searched for a
-- fellow student and got nothing back.
--
-- Owner's decision: students should be able to message instructors AND other
-- course participants. This migration makes visibility match that.
--
-- WHAT IT ADDS
--
-- One branch, deliberately written as the same predicate as
-- courses_shared_by_users (20260802050000): belonging to a course means
-- enrolled, OR being its instructor_id, OR being an instructor through
-- course_instructors. Stating it the same way is what keeps the two rules from
-- drifting apart again — the whole defect here was two definitions of the same
-- relationship maintained in separate places.
--
-- It covers a second gap in passing. The old rule only recognised
-- courses.instructor_id, so a co-instructor added through course_instructors —
-- which is exactly what the newly-reachable CourseInstructorsTab manages — was
-- invisible to the students they teach, while still being messageable.
--
-- WHAT IT DOES NOT CHANGE
--
-- The existing branches are kept rather than folded in. The new one subsumes
-- most of them, but course_assignments is a different table from
-- course_instructors and the conversation-participants branch reaches people
-- who no longer share a course; removing either would narrow visibility as a
-- side effect of widening it.
--
-- Row-level, so this exposes whole profile rows: alongside name, avatar and
-- bio, that includes notification_settings and preferences. Those columns were
-- already visible to instructors and to anyone you had a conversation with —
-- the category is not new, but the audience is larger. If they should be
-- private to the account, that needs column-level treatment (a view, or column
-- grants), which is a separate change from this one and is NOT done here.

CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id UUID, profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER -- bypasses RLS, preventing recursion through courses -> profiles
SET search_path = public
AS $$
  SELECT
    -- Can view own profile
    viewer_id = profile_id
    OR
    -- Anyone on a course you are also on: enrolled, its instructor_id, or an
    -- instructor through course_instructors. Same predicate as
    -- courses_shared_by_users, so "who I can see" and "who I may message" stay
    -- the same set.
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE (
              EXISTS (
                SELECT 1 FROM public.enrollments e
                WHERE e.course_id = c.id AND e.user_id = viewer_id
              )
              OR c.instructor_id = viewer_id
              OR public.is_course_instructor(viewer_id, c.id)
            )
        AND (
              EXISTS (
                SELECT 1 FROM public.enrollments e
                WHERE e.course_id = c.id AND e.user_id = profile_id
              )
              OR c.instructor_id = profile_id
              OR public.is_course_instructor(profile_id, c.id)
            )
    )
    OR
    -- Can view instructors of enrolled courses
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON c.id = e.course_id
      WHERE e.user_id = viewer_id
        AND c.instructor_id = profile_id
    )
    OR
    -- Instructors can view enrolled students
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON c.id = e.course_id
      WHERE c.instructor_id = viewer_id
        AND e.user_id = profile_id
    )
    OR
    -- Co-instructors can see each other
    EXISTS (
      SELECT 1 FROM public.course_assignments ca1
      JOIN public.course_assignments ca2 ON ca1.course_id = ca2.course_id
      WHERE ca1.user_id = viewer_id
        AND ca2.user_id = profile_id
    )
    OR
    -- Conversation participants can see each other
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = viewer_id
        AND cp2.user_id = profile_id
    )
    OR
    -- Admins can view all
    public.has_role(viewer_id, 'admin');
$$;

COMMENT ON FUNCTION public.can_view_profile IS
  'SECURITY DEFINER profile-visibility check; bypasses RLS to prevent recursion when courses queries join profiles. Grants sight of anyone sharing a course, using the same definition of belonging as courses_shared_by_users so visibility and messaging cannot drift apart.';
