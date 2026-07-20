
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS conversations_course_id_idx ON public.conversations(course_id);

CREATE OR REPLACE FUNCTION public.open_course_thread(
  p_course_id uuid,
  p_other_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_course RECORD;
  v_caller_is_instructor boolean;
  v_other_is_instructor boolean;
  v_caller_is_enrolled boolean;
  v_other_is_enrolled boolean;
  v_conv_id uuid;
  v_course_title text;
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
  v_course_title := v_course.title;

  -- Roles within this course
  v_caller_is_instructor := (v_course.instructor_id = v_caller)
    OR public.is_course_instructor(v_caller, p_course_id)
    OR public.has_role(v_caller, 'admin'::app_role);
  v_other_is_instructor := (v_course.instructor_id = p_other_user_id)
    OR public.is_course_instructor(p_other_user_id, p_course_id);

  v_caller_is_enrolled := EXISTS (
    SELECT 1 FROM public.enrollments WHERE course_id = p_course_id AND user_id = v_caller
  );
  v_other_is_enrolled := EXISTS (
    SELECT 1 FROM public.enrollments WHERE course_id = p_course_id AND user_id = p_other_user_id
  );

  -- Caller must be enrolled or instructor of the course
  IF NOT (v_caller_is_instructor OR v_caller_is_enrolled) THEN
    RAISE EXCEPTION 'You must be enrolled in this course to message about it';
  END IF;

  -- Students may ONLY message an instructor of the course
  IF (NOT v_caller_is_instructor) AND (NOT v_other_is_instructor) THEN
    RAISE EXCEPTION 'Students can only message the course instructor';
  END IF;

  -- Instructors may only message enrolled students or other course instructors
  IF v_caller_is_instructor AND (NOT v_other_is_instructor) AND (NOT v_other_is_enrolled) THEN
    RAISE EXCEPTION 'Recipient is not part of this course';
  END IF;

  -- Try to find an existing 1:1 course-scoped thread with both users
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
  VALUES (COALESCE('Course: ' || v_course_title, 'Course conversation'), false, v_caller, p_course_id)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_caller), (v_conv_id, p_other_user_id);

  RETURN v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_course_thread(uuid, uuid) TO authenticated;
