-- ABOUTME: Corrects a false statement inside can_view_profile's body. Logic is
-- ABOUTME: byte-identical to 20260802140000; only the inline comment changes.
--
-- WHY A MIGRATION FOR A COMMENT
--
-- Because the comment is deployed. `20260802140000` said the new branch admits
-- "an instructor through course_instructors", and Codex pointed out on #71 that
-- it does not: the branch calls `is_course_instructor()`, which reads
-- `courses.instructor_id` and `course_assignments` and has never read
-- `course_instructors`.
--
-- That correction was made to the migration file's header but NOT to the comment
-- inside the function body, so the false version is what
-- `pg_get_functiondef(can_view_profile)` still prints — and that is what the next
-- person debugging profile visibility will read. A wrong comment inside a
-- security-relevant function is worth one no-op migration to remove.
--
-- Verified while writing this: `course_instructors` is referenced by NO policy,
-- trigger, view or other function anywhere in the database. The only object
-- mentioning it at all was this comment.
--
-- The predicate below is unchanged from 20260802140000. Compare them line by
-- line before believing this file — a "comment-only" migration that quietly
-- alters a permission would be the worst possible thing to hide here.

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
    -- instructor that is_course_instructor() recognizes — which is
    -- courses.instructor_id or a course_assignments row with role 'instructor',
    -- NOT the course_instructors table. Same predicate as
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
    public.has_role(viewer_id, 'admin'::app_role);
$$;
