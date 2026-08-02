-- ABOUTME: course_contacts(p_course_id) — everyone in a course the caller may
-- ABOUTME: open a thread with, so the picker can offer who the RPC accepts.
--
-- WHY THIS EXISTS
--
-- The New Message picker could not show a student their classmates, and no
-- amount of profile-visibility widening was going to fix it.
--
-- `CourseThreadComposer.fetchCourseContacts` assembled its list client-side from
-- `courses` + `enrollments` + `course_assignments`. But `enrollments` is
-- RLS-restricted to `user_id = auth.uid()` OR staff (`has_admin_access`,
-- `is_course_instructor`), so a student reading it back gets exactly one row —
-- their own. `enrolledIds` therefore collapsed to `[me]`, and the picker offered
-- nothing but teaching staff no matter who was in the course.
--
-- Measured against production before writing this, signed in as the seeded
-- member on the reference course:
--
--     enrollments visible: 1   (their own)
--     course_assignments:  0
--     profiles visible:   16   (20260802140000 works; the list never asked)
--
-- So `20260802020300` dropped the student-to-student restriction in
-- `open_course_thread`, `20260802140000` let classmates see each other's
-- profiles, and the UI still could not reach either — it was enumerating
-- membership through a table that hides it. e2e/messaging/new-conversation.spec.ts
-- caught it on main.
--
-- WHY A FUNCTION RATHER THAN AN RLS POLICY ON enrollments
--
-- Opening `enrollments` to every course member would fix the picker by widening
-- a table read for every other consumer of that table too — grades, progress and
-- roster code all select from it. This grants exactly one thing: the list of
-- people you are already permitted to message.
--
-- It also puts the membership rule in ONE place. `open_course_thread` decides
-- who may be messaged; this returns precisely that set, written with the same
-- predicate. The bug being fixed here is what happens when a second definition
-- of "belongs to this course" drifts from the first — the third time today that
-- has bitten, after courses_shared_by_users and can_view_profile.
--
-- SECURITY
--
-- SECURITY DEFINER, so it must not become a way to enumerate arbitrary courses.
-- A caller who neither takes nor teaches the course gets zero rows, which is the
-- same answer `open_course_thread` gives them and the same answer the old
-- client-side code gave. Admins are admitted as callers (they may open a thread
-- about any course) but, as everywhere else in this schema, are NOT added to
-- anyone's contact list — that would make every admin addressable from every
-- course. The caller is never included in their own results.

CREATE OR REPLACE FUNCTION public.course_contacts(p_course_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller AS (SELECT auth.uid() AS id),
  course AS (
    SELECT c.id, c.instructor_id FROM public.courses c WHERE c.id = p_course_id
  ),
  -- Same rule as open_course_thread's v_caller_in_course, admin clause included.
  caller_belongs AS (
    SELECT EXISTS (
      SELECT 1 FROM course c, caller
      WHERE c.instructor_id = caller.id
         OR public.is_course_instructor(caller.id, p_course_id)
         OR public.has_role(caller.id, 'admin'::app_role)
         OR EXISTS (
              SELECT 1 FROM public.enrollments e
              WHERE e.course_id = p_course_id AND e.user_id = caller.id
            )
    ) AS ok
  ),
  -- Same rule as open_course_thread's v_other_in_course: no admin clause, so an
  -- admin is not silently addressable from a course they have nothing to do with.
  members AS (
    SELECT c.instructor_id AS user_id FROM course c WHERE c.instructor_id IS NOT NULL
    UNION
    SELECT e.user_id FROM public.enrollments e WHERE e.course_id = p_course_id
    UNION
    SELECT ca.user_id FROM public.course_assignments ca
     WHERE ca.course_id = p_course_id AND ca.role = 'instructor'
  )
  SELECT p.id,
         p.first_name,
         p.last_name,
         p.avatar_url,
         CASE
           WHEN (SELECT c.instructor_id FROM course c) = p.id
             OR public.is_course_instructor(p.id, p_course_id)
           THEN 'instructor'
           ELSE 'student'
         END AS role
  FROM members m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE (SELECT ok FROM caller_belongs)
    AND m.user_id IS DISTINCT FROM (SELECT id FROM caller)
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$$;

COMMENT ON FUNCTION public.course_contacts(uuid) IS
  'Everyone in a course the caller may open a thread with, using the same membership rule as open_course_thread. Zero rows for a caller who is not in the course. Exists because enrollments is RLS-restricted to your own row, so the client cannot enumerate a course''s members.';

REVOKE ALL ON FUNCTION public.course_contacts(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.course_contacts(uuid) TO authenticated, service_role;
