-- Anyone in a course may message anyone else in that course.
--
-- `open_course_thread` used to enforce a strict hierarchy: a student could only
-- ever address an instructor of the course ("Students can only message the course
-- instructor"), and an instructor could only address enrolled students or
-- co-instructors. Classmates could not talk to each other at all.
--
-- That is no longer the product rule. `messages-helper` was redeployed to derive a
-- conversation's course from `courses_shared_by_users` — a set of people can hold a
-- conversation if they all belong to some common course — which allowed exactly the
-- student-to-student thread this function refused. Two rules disagreeing about who
-- may talk to whom is worse than either rule on its own: which one applies depends
-- on whether the caller went through the RPC or the Edge Function, and only one of
-- those is reachable from any given screen. The looser rule is the decision, so this
-- makes the RPC agree rather than leaving the contradiction in place.
--
-- What changes: the recipient no longer has to hold a particular ROLE relative to
-- the caller, only membership of the same course.
--
-- What deliberately does not change:
--   * the caller must still be in the course (admins excepted, as before)
--   * the recipient must still genuinely be in the course — note there is no admin
--     clause on that side, because it would make every admin addressable from
--     every course on the site
--   * self-messaging, unknown courses, and cross-course pairs are still refused
--   * one thread per (course, pair), reused rather than duplicated
--   * READING is untouched. Being allowed to start a thread with someone has never
--     been the same as being allowed to read theirs; that is RLS on `messages` and
--     `conversations`, and it still restricts every row to its participants.
--
-- Verified against the live database on 2026-08-02, under simulated JWTs in a
-- rolled-back transaction:
--
--   student -> classmate in the same course ......... ALLOWED  (this is the change)
--   student -> their instructor ..................... ALLOWED
--   instructor -> enrolled student .................. ALLOWED
--   not-enrolled -> instructor ...................... BLOCKED  'must be enrolled'
--   student -> someone not in the course ............ BLOCKED  'not part of this course'
--   instructor -> a course they do not teach ........ BLOCKED  'must be enrolled'
--   anyone -> self .................................. BLOCKED  'Invalid recipient'

CREATE OR REPLACE FUNCTION public.open_course_thread(p_course_id uuid, p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION public.open_course_thread(uuid, uuid) IS
  'Finds or creates the 1:1 thread between two members of a course. Either party may start it; both must belong to the course.';
