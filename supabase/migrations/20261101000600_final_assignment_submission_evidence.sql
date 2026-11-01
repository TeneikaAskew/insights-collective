-- PREPARED ON A BRANCH. NOT APPLIED to any hosted database. Apply only through db-migrate.yml after review.
-- T-09 r5 (local repro: scripts/local-db/tests/09_final_submission_evidence.sql, live-equivalent 10/21, r4 11/21).
-- 1. One definition of a FINAL assignment submission, used by the completion guard and the certificate issuer:
--    workflow_state 'graded', or 'submitted' with submitted_at set. It matches the client contract
--    (lessonCompletionService: workflow_state in submitted/graded) and the notify trigger (submitted + timestamp).
--    Before: both server checks used submitted_at IS NOT NULL only, so a learner's own timestamped staged/draft/
--    NULL-state submission completed the assignment and issued a certificate, and a submission reverted to
--    unsubmitted kept counting for NEW certificates.
-- 2. A learner can no longer set their own submission to 'graded' on UPDATE (the INSERT pin already downgrades it).
-- 3. The restrictive UPDATE policies now check the OLD target too (USING), not only the NEW row (WITH CHECK):
--    before, a learner could move their progress row FROM a hidden item to a visible one.
-- No passing-score rule; 'graded' counts whatever the score. No row, history or certificate is changed: done rows
-- and existing certificates stay; only NEW completions and NEW certificates need final evidence.
CREATE OR REPLACE FUNCTION public.is_final_assignment_submission(p_workflow_state text, p_submitted_at timestamptz)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $$
  SELECT p_workflow_state = 'graded' OR (p_workflow_state = 'submitted' AND p_submitted_at IS NOT NULL)
$$;
COMMENT ON FUNCTION public.is_final_assignment_submission(text, timestamptz) IS
  'Final-submission evidence for completion and certificates: graded, or submitted with a timestamp. Keep in step with lessonCompletionService.';

CREATE OR REPLACE FUNCTION public.enforce_assessed_progression()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_type text;
BEGIN
  IF NEW.workflow_state NOT IN ('read', 'completed', 'graded') THEN
    RETURN NEW;
  END IF;
  -- Only a row that keeps its identity may skip the check; a row moved to another item or learner is a new completion.
  IF TG_OP = 'UPDATE' AND OLD.workflow_state IN ('read', 'completed', 'graded')
     AND NEW.content_item_id IS NOT DISTINCT FROM OLD.content_item_id
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  SELECT type::text INTO v_type FROM public.content_items WHERE id = NEW.content_item_id;

  IF v_type = 'assignment' AND NOT EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.assignment_submissions s ON s.assignment_id = a.id
    WHERE a.content_item_id = NEW.content_item_id
      AND s.user_id = NEW.user_id
      AND public.is_final_assignment_submission(s.workflow_state, s.submitted_at)
  ) THEN
    RAISE EXCEPTION 'Assignment must be submitted before it can be marked complete'
      USING ERRCODE = 'check_violation';
  END IF;

  -- A started attempt ('pending_review', written by start_quiz_attempt) is not a submission.
  IF v_type = 'quiz' AND NOT EXISTS (
    SELECT 1 FROM public.quizzes z
    JOIN public.quiz_submissions q ON q.quiz_id = z.id
    WHERE z.content_item_id = NEW.content_item_id
      AND q.user_id = NEW.user_id
      AND q.workflow_state = 'complete'
      AND q.finished_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Quiz must be submitted before it can be marked complete'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_issue_certificate_on_progression()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_total int;
  v_completed int;
  v_code text;
BEGIN
  IF NEW.workflow_state NOT IN ('read', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT m.course_id
    INTO v_course_id
    FROM public.content_items ci
    JOIN public.modules m ON m.id = ci.module_id
   WHERE ci.id = NEW.content_item_id;

  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if a certificate already exists for this user/course
  IF EXISTS (
    SELECT 1 FROM public.certificates
     WHERE user_id = NEW.user_id AND course_id = v_course_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.content_items ci
    JOIN public.modules m ON m.id = ci.module_id
   WHERE m.course_id = v_course_id
     AND m.published = true
     AND ci.published = true;

  IF v_total = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(DISTINCT p.content_item_id) INTO v_completed
    FROM public.content_item_progressions p
    JOIN public.content_items ci ON ci.id = p.content_item_id
    JOIN public.modules m ON m.id = ci.module_id
   WHERE p.user_id = NEW.user_id
     AND m.course_id = v_course_id
     AND m.published = true
     AND ci.published = true
     AND p.workflow_state IN ('read', 'completed')
     -- A NEW certificate needs genuine evidence behind every required assessment, not just a done row: rows written
     -- before the completion guard (or by a since-closed path) are left as they are, but no longer count here.
     AND (
       ci.type::text NOT IN ('assignment', 'quiz')
       OR (ci.type::text = 'assignment' AND EXISTS (
             SELECT 1 FROM public.assignments a
             JOIN public.assignment_submissions s ON s.assignment_id = a.id
            WHERE a.content_item_id = ci.id AND s.user_id = NEW.user_id AND public.is_final_assignment_submission(s.workflow_state, s.submitted_at)))
       OR (ci.type::text = 'quiz' AND EXISTS (
             SELECT 1 FROM public.quizzes z
             JOIN public.quiz_submissions q ON q.quiz_id = z.id
            WHERE z.content_item_id = ci.id AND q.user_id = NEW.user_id
              AND q.workflow_state = 'complete' AND q.finished_at IS NOT NULL))
     );

  IF v_completed < v_total THEN
    RETURN NEW;
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.certificates (
    user_id, course_id, certificate_type, certificate_data, verification_code, issued_at
  ) VALUES (
    NEW.user_id,
    v_course_id,
    'completion',
    jsonb_build_object(
      'completion_percentage', 100,
      'total_items', v_total,
      'auto_issued', true
    ),
    v_code,
    now()
  )
  ON CONFLICT (user_id, course_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pin_assignment_grade_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  NEW.grade           := OLD.grade;
  NEW.score           := OLD.score;
  NEW.graded_at       := OLD.graded_at;
  NEW.grader_comments := OLD.grader_comments;
  NEW.rubric_scores   := OLD.rubric_scores;
  NEW.excused         := OLD.excused;
  NEW.late            := OLD.late;
  NEW.missing         := OLD.missing;
  -- 'graded' is a grading outcome: only staff may move a submission into it (INSERT is pinned the same way).
  IF NEW.workflow_state = 'graded' AND OLD.workflow_state IS DISTINCT FROM 'graded' THEN
    NEW.workflow_state := OLD.workflow_state;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER POLICY "Submission target must be accessible (update)" ON public.assignment_submissions
  USING (public.can_access_assignment(auth.uid(), assignment_id));
ALTER POLICY "Progress target must be accessible (update)" ON public.content_item_progressions
  USING (public.can_access_content_item(auth.uid(), content_item_id));
