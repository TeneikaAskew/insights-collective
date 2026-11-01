-- ABOUTME: A quiz counts as done only after a SUBMITTED attempt, and only the server (or staff of that quiz's course)
-- ABOUTME: can mark an attempt submitted. Closes the start_quiz_attempt -> pending_review -> mark-complete loophole (T-09).
--
-- STATUS: PREPARED ON A BRANCH. NOT APPLIED TO PRODUCTION. Apply only through db-migrate.yml after review
-- (CLAUDE.md "Apply migrations through db-migrate.yml"). No data is changed: historical progressions and
-- certificates are untouched (T-07 handles them read-only, pending approval).
--
-- Evidence (local snapshot of the live schema, scripts/local-db/tests/04_quiz_completion_integrity.sql, 9 of 17 fail
-- before this file, 17 of 17 after):
--   * start_quiz_attempt() inserts the attempt with workflow_state 'pending_review' at START (no answers, no score,
--     finished_at null). score-quiz -> finalize_quiz_submission() is the only submit path and always sets 'complete'
--     with finished_at; nothing in the app writes 'pending_review' as "submitted, awaiting grading".
--   * enforce_assessed_progression() accepted ('complete', 'pending_review'), so starting a quiz was enough to mark it
--     complete, and auto_issue_certificate_on_progression() then issued the certificate.
--   * Policy "Users can update their own quiz submissions" plus pin_quiz_submission_score(), which pins the score but
--     not the state, let a learner UPDATE their own attempt to 'complete'. A learner holding the global instructor role
--     (is_grading_staff) skipped the pin entirely, in any course.
--
-- Change:
--   1. enforce_assessed_progression: a quiz needs an attempt with workflow_state 'complete' AND finished_at set.
--      The assignment branch is unchanged (submitted_at IS NOT NULL).
--   2. pin_quiz_submission_score: an UPDATE into 'complete' (and finished_at) is kept only for service_role
--      (finalize_quiz_submission via score-quiz) or staff who can manage THIS quiz (can_manage_quiz). Anyone else keeps
--      the old state and finished_at, silently, as the existing pins do for score. Score pinning is unchanged.
-- Not decided here (product decision): whether a submitted attempt must also have answers or a passing score.

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
  IF TG_OP = 'UPDATE' AND OLD.workflow_state IN ('read', 'completed', 'graded') THEN
    RETURN NEW;
  END IF;

  SELECT type::text INTO v_type FROM public.content_items WHERE id = NEW.content_item_id;

  IF v_type = 'assignment' AND NOT EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.assignment_submissions s ON s.assignment_id = a.id
    WHERE a.content_item_id = NEW.content_item_id
      AND s.user_id = NEW.user_id
      AND s.submitted_at IS NOT NULL
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

CREATE OR REPLACE FUNCTION public.pin_quiz_submission_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Submitting is the server's: only finalize_quiz_submission (service_role, via score-quiz) or staff who manage
  -- THIS quiz may move an attempt into 'complete'. Checked before the global staff shortcut below, because
  -- is_grading_staff() is true for any instructor in any course.
  IF TG_OP = 'UPDATE'
     AND NEW.workflow_state = 'complete'
     AND OLD.workflow_state IS DISTINCT FROM 'complete'
     AND NOT (
       NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' IS NOT DISTINCT FROM 'service_role'
       OR public.can_manage_quiz(auth.uid(), NEW.quiz_id)
     ) THEN
    NEW.workflow_state := OLD.workflow_state;
    NEW.finished_at := OLD.finished_at;
  END IF;

  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new attempt starts ungraded; only score-quiz may set a score.
    NEW.score := NULL;
    NEW.kept_score := NULL;
    IF NEW.workflow_state = 'complete' THEN
      NEW.workflow_state := 'pending_review';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: the score and the finalized state are the server's to set.
  NEW.score := OLD.score;
  NEW.kept_score := OLD.kept_score;
  IF OLD.workflow_state = 'complete' THEN
    NEW.workflow_state := OLD.workflow_state;
  END IF;

  RETURN NEW;
END;
$function$;
