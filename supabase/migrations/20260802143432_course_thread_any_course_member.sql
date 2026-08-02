-- ABOUTME: Records the already-applied relaxation of open_course_thread, which
-- ABOUTME: lets any two members of a course open a thread instead of students
-- ABOUTME: being able to message only the instructor.
--
-- THIS MIGRATION IS ALREADY APPLIED. It is transcribed here, verbatim and under
-- its own recorded version, from supabase_migrations.schema_migrations —
-- version 20260802143432, name `course_thread_any_course_member`, applied
-- 2026-08-02 14:34:32 UTC. Supabase matches on version, so a `db push` against
-- production sees it as done and skips it; the point of the file is that a
-- fresh database, a restore, or a local `db reset` ends up with the same
-- function production actually has.
--
-- WHY IT IS BEING TRANSCRIBED
--
-- The repo said something different from the database, and the difference was
-- a permission. `20260720113448_9f30b1b2-…sql` creates this function with a
-- `Students can only message the course instructor` branch. That branch is not
-- in the live function, so anyone rebuilding from migrations would have got a
-- stricter database than production — and the drift only surfaced because
-- e2e/journeys/messaging-notifications-hardening.spec.ts asserts the old
-- restriction and went red mid-run, sixty seconds after the change landed.
--
-- WHAT CHANGED, PRECISELY
--
-- Before: the recipient had to be the course's instructor unless the caller was
-- staff — `RAISE EXCEPTION 'Students can only message the course instructor'`.
-- After: the recipient must belong to the course, by the same test applied to
-- the caller. Student-to-student threads within a course are now permitted.
--
-- This is the intended policy, not an accident: students should be able to
-- message instructors AND other course participants. It is the RPC half of the
-- same decision that migration 20260802140000 makes for profile visibility, and
-- the two now agree — you can see, and open a thread with, the people you share
-- a course with.
--
-- What did NOT change, and is worth not losing: the caller must still be in the
-- course, admins are still admitted as callers but deliberately NOT as
-- recipients (that would make every admin addressable from every course), self
-- and unknown courses are still rejected, and the find-then-create shape is
-- unchanged so the function stays idempotent per pair.

CREATE OR REPLACE FUNCTION public.open_course_thread(p_course_id uuid, p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_course RECORD;
  v_caller_in_course boolean;
  v_other_in_course boolean;
  v_conv_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_caller THEN
    RAISE EXCEPTION 'Invalid recipient';
  END IF;

  SELECT id, title, instructor_id INTO v_course
  FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  -- Admins may open a thread about any course; everyone else has to be in it.
  v_caller_in_course :=
       (v_course.instructor_id = v_caller)
    OR public.is_course_instructor(v_caller, p_course_id)
    OR public.has_role(v_caller, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = p_course_id AND e.user_id = v_caller);

  -- The recipient must genuinely be in the course. Deliberately no admin clause
  -- here: that would make every admin addressable from every course.
  v_other_in_course :=
       (v_course.instructor_id = p_other_user_id)
    OR public.is_course_instructor(p_other_user_id, p_course_id)
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = p_course_id AND e.user_id = p_other_user_id);

  IF NOT v_caller_in_course THEN
    RAISE EXCEPTION 'You must be enrolled in this course to message about it';
  END IF;
  IF NOT v_other_in_course THEN
    RAISE EXCEPTION 'Recipient is not part of this course';
  END IF;

  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  WHERE c.course_id = p_course_id
    AND c.deleted_at IS NULL
    AND COALESCE(c.is_group, false) = false
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = v_caller)
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = p_other_user_id)
    AND (SELECT COUNT(*) FROM public.conversation_participants cp WHERE cp.conversation_id = c.id) = 2
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  INSERT INTO public.conversations (subject, is_group, created_by, course_id)
  VALUES (COALESCE('Course: ' || v_course.title, 'Course conversation'), false, v_caller, p_course_id)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_caller), (v_conv_id, p_other_user_id);

  RETURN v_conv_id;
END;
$fn$;

COMMENT ON FUNCTION public.open_course_thread(uuid, uuid) IS
  'Finds or creates the 1:1 thread between two members of a course. Either party may start it; both must belong to the course.';
