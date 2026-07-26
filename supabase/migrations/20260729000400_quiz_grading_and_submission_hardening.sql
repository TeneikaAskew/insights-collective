-- Second round of review fixes: student assignment uploads, reveal-gated
-- per-question results, and atomic attempt-limit finalization.

-- ---------------------------------------------------------------------------
-- 1. Student assignment-attachment uploads (regression fix)
-- ---------------------------------------------------------------------------
-- Dropping the permissive "authenticated can upload" policies on the three
-- course buckets left only the course_*_insert policies, which require
-- can_manage_course_materials (instructors/admins). But students upload
-- assignment attachments to these buckets via FileUploadZone, so every student
-- submission now fails. Give submissions their own path — submissions/<courseId>/
-- <userId>/<file> — and a policy that authorizes the enrolled owner to write
-- there, without restoring general course-material writes.
CREATE POLICY "course_submission_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('course-images', 'course-videos', 'course-documents')
    AND split_part(name, '/', 1) = 'submissions'
    AND NULLIF(split_part(name, '/', 3), '')::uuid = auth.uid()
    AND public.can_access_course_materials(
          auth.uid(), NULLIF(split_part(name, '/', 2), '')::uuid)
  );

CREATE POLICY "course_submission_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('course-images', 'course-videos', 'course-documents')
    AND split_part(name, '/', 1) = 'submissions'
    AND (
      NULLIF(split_part(name, '/', 3), '')::uuid = auth.uid()
      OR public.can_manage_course_materials(
           auth.uid(), NULLIF(split_part(name, '/', 2), '')::uuid)
    )
  );

CREATE POLICY "course_submission_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('course-images', 'course-videos', 'course-documents')
    AND split_part(name, '/', 1) = 'submissions'
    AND NULLIF(split_part(name, '/', 3), '')::uuid = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 2. Reveal-gate the learner's view of their own graded answer rows
-- ---------------------------------------------------------------------------
-- quiz_submission_answers carries per-question `correct`/`points`. The learner
-- SELECT policy exposed those on their own rows the instant score-quiz wrote
-- them, so a multi-attempt learner could read the grading of attempt 1 before
-- attempt 2 — the same leak get_quiz_questions_for_taking already closes for the
-- key. Gate the learner's read the same way: only once no attempt remains and
-- the quiz permits showing answers. Instructors keep their own (separate) policy.
DROP POLICY IF EXISTS "Users can view their own quiz submission answers" ON public.quiz_submission_answers;
CREATE POLICY "Users can view their own quiz submission answers" ON public.quiz_submission_answers
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_submissions qs
      JOIN public.quizzes q ON q.id = qs.quiz_id
      WHERE qs.id = quiz_submission_answers.quiz_submission_id
        AND qs.user_id = auth.uid()
        AND COALESCE(q.show_correct_answers, true)
        AND q.allowed_attempts IS NOT NULL
        AND q.allowed_attempts > 0
        AND (
          SELECT count(*) FROM public.quiz_submissions s2
          WHERE s2.quiz_id = qs.quiz_id
            AND s2.user_id = auth.uid()
            AND s2.workflow_state = 'complete'
        ) >= q.allowed_attempts
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Atomic attempt-limit finalization
-- ---------------------------------------------------------------------------
-- score-quiz checked the completed-attempt count and then finalized in separate
-- round trips, so N concurrent requests (each its own pending attempt row) could
-- all observe a sub-limit count and all finalize, exceeding allowed_attempts and
-- turning per-question results into an oracle. This serializes finalization per
-- (user, quiz) under a transaction advisory lock, re-checks the limit inside the
-- lock, and finalizes. Executed only by the score-quiz service-role client
-- (EXECUTE revoked from everyone), for which the grade-pinning triggers pass.
CREATE OR REPLACE FUNCTION public.finalize_quiz_submission(
  p_submission_id uuid,
  p_score integer,
  p_time_spent integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_quiz uuid;
  v_state text;
  v_allowed integer;
  v_show boolean;
  v_completed integer;
  v_reveal boolean;
BEGIN
  SELECT user_id, quiz_id, workflow_state
    INTO v_user, v_quiz, v_state
  FROM public.quiz_submissions
  WHERE id = p_submission_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user::text), hashtext(v_quiz::text));

  IF v_state = 'complete' THEN
    RAISE EXCEPTION 'Attempt already submitted';
  END IF;

  SELECT allowed_attempts, COALESCE(show_correct_answers, true)
    INTO v_allowed, v_show
  FROM public.quizzes
  WHERE id = v_quiz;

  SELECT count(*) INTO v_completed
  FROM public.quiz_submissions
  WHERE quiz_id = v_quiz
    AND user_id = v_user
    AND workflow_state = 'complete';

  IF v_allowed IS NOT NULL AND v_allowed > 0 AND v_completed >= v_allowed THEN
    RAISE EXCEPTION 'Attempt limit reached';
  END IF;

  UPDATE public.quiz_submissions
  SET finished_at = now(),
      time_spent = p_time_spent,
      score = p_score,
      kept_score = p_score,
      workflow_state = 'complete'
  WHERE id = p_submission_id;

  v_reveal := v_show
    AND v_allowed IS NOT NULL
    AND v_allowed > 0
    AND (v_completed + 1) >= v_allowed;

  RETURN jsonb_build_object('reveal', v_reveal);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalize_quiz_submission(uuid, integer, integer)
  FROM public, anon, authenticated;
