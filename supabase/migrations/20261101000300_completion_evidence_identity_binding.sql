-- PREPARED ON A BRANCH. NOT APPLIED to any hosted database. Apply only through db-migrate.yml after review.
-- T-09 follow-on: completion evidence stays bound to its own identity (local repro: scripts/local-db/tests/05_identity_retarget.sql).
-- 1. enforce_assessed_progression: the "already done" early return on UPDATE applied whatever the row was moved to,
--    so a learner could move a read/completed row's content_item_id onto a never-attempted quiz and keep it done.
--    The early return now requires the row's identity (content_item_id, user_id) to be unchanged; a moved row is
--    checked like a new completion of its new item. Nothing else in the function changes.
-- 2. quiz_submissions: the learner UPDATE policy allowed changing quiz_id, and the score/state pins keep a finalized
--    attempt 'complete', so a finalized attempt on quiz A could be moved to never-attempted quiz B. A new BEFORE UPDATE
--    trigger keeps quiz_id and user_id for API callers other than service_role (score-quiz), silently, like the
--    existing pins. Direct database sessions without request claims (migrations, owner maintenance) are unaffected.
-- No policy change (minimum submission stays), no score/pass rule, no data change, no historical correction.
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

CREATE OR REPLACE FUNCTION public.pin_quiz_submission_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
BEGIN
  -- An attempt belongs to one quiz and one learner for life. Only score-quiz (service_role) and direct database
  -- sessions without API claims may change either column; every API caller keeps the stored identity.
  IF v_role IS NOT NULL AND v_role <> 'service_role' THEN
    NEW.quiz_id := OLD.quiz_id;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pin_quiz_submission_identity ON public.quiz_submissions;
CREATE TRIGGER pin_quiz_submission_identity BEFORE UPDATE ON public.quiz_submissions
  FOR EACH ROW EXECUTE FUNCTION public.pin_quiz_submission_identity();
REVOKE ALL ON FUNCTION public.pin_quiz_submission_identity() FROM PUBLIC, anon, authenticated;
