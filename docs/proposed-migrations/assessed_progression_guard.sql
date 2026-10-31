-- ABOUTME: PROPOSED, NOT APPLIED. Server-side guard so assignment/quiz progressions can only be marked
-- ABOUTME: done once a real submission exists. Additive: touches no existing rows. Needs explicit approval.
--
-- Why: content_item_progressions RLS lets a student INSERT/UPDATE their own rows with any
-- workflow_state, and auto_issue_certificate_on_progression() counts 'read'/'completed'.
-- The browser fix stops the app from doing this; this trigger stops direct API writes.
--
-- Existing data (live read, 2026-10-31): 23 of 28 done assignment rows and 12 of 14 done quiz
-- rows have no matching submission. This trigger does NOT change or delete them; they
-- still count toward completion until a separate, approved reconciliation decides what to do.

CREATE OR REPLACE FUNCTION public.enforce_assessed_progression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_type text;
BEGIN
  IF NEW.workflow_state NOT IN ('read', 'completed', 'graded') THEN
    RETURN NEW;
  END IF;
  -- Leave unchanged done rows alone (e.g. an updated_at touch).
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

  IF v_type = 'quiz' AND NOT EXISTS (
    SELECT 1 FROM public.quizzes z
    JOIN public.quiz_submissions q ON q.quiz_id = z.id
    WHERE z.content_item_id = NEW.content_item_id
      AND q.user_id = NEW.user_id
      AND q.workflow_state IN ('complete', 'pending_review')
  ) THEN
    RAISE EXCEPTION 'Quiz must be submitted before it can be marked complete'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE trigger: runs ahead of the AFTER certificate trigger, so a rejected write
-- can never issue a certificate.
CREATE TRIGGER trg_enforce_assessed_progression
BEFORE INSERT OR UPDATE ON public.content_item_progressions
FOR EACH ROW EXECUTE FUNCTION public.enforce_assessed_progression();
