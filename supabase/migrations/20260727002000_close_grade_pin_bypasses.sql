-- Close two bypasses in 20260727001000_pin_grade_columns.sql (both raised in
-- review on PR #16). That migration gated UPDATE only, which left the grade
-- columns writable through two other paths.

-- 1. INSERT bypass on assignment_submissions.
--
--    The pin trigger was BEFORE UPDATE, and the INSERT policy is only
--    `WITH CHECK (auth.uid() = user_id)` -- nothing constrains which columns an
--    inserting student may set. A student could therefore skip the guarded
--    UPDATE entirely and INSERT a fresh owned row carrying grade/score/
--    graded_at/grader_comments/rubric_scores, plus the excused/late/missing
--    determinations. Every legitimate student insert path
--    (assignmentService.createSubmission/submitAssignment,
--    InlineAssignmentSubmit) writes only assignment_id, user_id, body, url,
--    submission_type, submitted_at, workflow_state and attempt, so pinning the
--    grade-bearing columns to their defaults on insert costs nothing.
--
--    Assignments are instructor-graded end to end -- unlike quizzes there is no
--    client-scoring flow to preserve -- so these columns are cleared outright
--    rather than merely frozen.
CREATE OR REPLACE FUNCTION public.pin_assignment_grade_columns_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  -- Cleared, not reverted: on INSERT there is no OLD row to fall back to.
  NEW.grade           := NULL;
  NEW.score           := NULL;
  NEW.graded_at       := NULL;
  NEW.grader_comments := NULL;
  NEW.rubric_scores   := NULL;
  NEW.excused         := false;
  NEW.late            := false;
  NEW.missing         := false;

  -- A student may assert that work was submitted, not that it was graded.
  -- Inserting 'graded' would surface a graded-looking row in the gradebook even
  -- with a null grade, so coerce it; other states are student-assertable.
  IF NEW.workflow_state = 'graded' THEN
    NEW.workflow_state := 'submitted';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pin_assignment_grade_columns_on_insert ON public.assignment_submissions;
CREATE TRIGGER pin_assignment_grade_columns_on_insert
  BEFORE INSERT ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.pin_assignment_grade_columns_on_insert();

-- 2. Two-step reopen on quiz_submissions.
--
--    freeze_finalized_quiz_score froze score/kept_score when
--    OLD.workflow_state = 'complete', but left workflow_state itself writable.
--    A student could therefore split the tamper across two statements: first
--    move an owned complete row back to 'pending_review' (the freeze preserves
--    the score but not the state), then, with OLD.workflow_state no longer
--    'complete', rewrite score/kept_score and set the state back to 'complete'.
--
--    Pinning workflow_state alongside the scores closes it. Nothing legitimate
--    moves a finalized row: InlineQuizPlayer and CanvasQuizTaking both INSERT a
--    new row at attempt + 1 for a retake, and the finalize write itself still
--    passes because OLD.workflow_state is 'pending_review' at that point.
CREATE OR REPLACE FUNCTION public.freeze_finalized_quiz_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  IF OLD.workflow_state = 'complete' THEN
    NEW.score          := OLD.score;
    NEW.kept_score     := OLD.kept_score;
    -- Without this the freeze is one statement deep: clearing the state first
    -- would make the next UPDATE see a non-complete OLD row and unfreeze it.
    NEW.workflow_state := OLD.workflow_state;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists from 20260727001000 and is unchanged; CREATE OR REPLACE
-- above swaps the function body underneath it.

COMMENT ON FUNCTION public.freeze_finalized_quiz_score IS
  'Freezes score, kept_score and workflow_state once a quiz submission is complete. workflow_state is pinned too so the freeze cannot be lifted by first reopening the row.';

COMMENT ON FUNCTION public.pin_assignment_grade_columns_on_insert IS
  'Clears instructor-authored grade columns on student INSERT. Assignments have no client-scoring flow, so students never author these values.';
