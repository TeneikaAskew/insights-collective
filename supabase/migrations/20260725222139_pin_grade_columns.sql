-- Stop students from writing their own grades (F6).
--
-- Mechanism note: this is NOT a missing-WITH_CHECK problem. For UPDATE
-- policies Postgres reuses the USING expression as the check when WITH CHECK
-- is omitted, so `USING (auth.uid() = user_id)` already prevents reassigning a
-- row to another user. The hole is column-level: `authenticated` holds a
-- table-wide UPDATE grant and nothing pins the grade-bearing columns, so a
-- student can UPDATE their own row and set their own score.
--
-- Column-level REVOKE is not usable here: instructors grade from the browser
-- as `authenticated` too (src/pages/CanvasGradingInterface.tsx), so removing
-- the column grant would break grading along with tampering. The gate has to
-- be row-aware, which means a trigger.

-- Shared staff predicate. user_roles is the canonical role source; profiles.roles
-- is a mirror and is deliberately not consulted.
CREATE OR REPLACE FUNCTION public.is_grading_staff()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('instructor'::app_role, 'admin'::app_role)
  );
END;
$$;

COMMENT ON FUNCTION public.is_grading_staff IS
  'True when the caller may write grade-bearing columns. Row-level scoping is still enforced by each table''s RLS policies; this only gates which columns may change.';

-- 1. assignment_submissions: grades are instructor-authored. A student has no
--    legitimate reason to write any of these, so pin them outright.
CREATE OR REPLACE FUNCTION public.pin_assignment_grade_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  -- Silently revert rather than raise: clients PATCH partial rows and a
  -- legitimate student edit (e.g. resubmitting content) must not become a hard
  -- error just because it echoes back an unchanged grade.
  NEW.grade           := OLD.grade;
  NEW.score           := OLD.score;
  NEW.graded_at       := OLD.graded_at;
  NEW.grader_comments := OLD.grader_comments;
  NEW.rubric_scores   := OLD.rubric_scores;
  -- Instructor/system determinations, not student-assertable.
  NEW.excused         := OLD.excused;
  NEW.late            := OLD.late;
  NEW.missing         := OLD.missing;
  -- workflow_state is deliberately NOT pinned: students legitimately move a
  -- row to 'submitted'. Grade columns above are what gate 'graded' from
  -- meaning anything.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pin_assignment_grade_columns ON public.assignment_submissions;
CREATE TRIGGER pin_assignment_grade_columns
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.pin_assignment_grade_columns();

-- 2. quiz_submissions: quizzes are scored in the browser
--    (src/components/course/learn/InlineQuizPlayer.tsx computes totalScore and
--    writes score/kept_score), so the student writing their own score IS the
--    legitimate flow and cannot simply be blocked without breaking quizzes.
--
--    What we can close is retroactive tampering: once a submission is
--    finalized, its score is frozen. The finalize write itself flips
--    workflow_state to 'complete' in the same statement, so OLD.workflow_state
--    is still 'pending_review' there and the legitimate path passes. Retakes
--    INSERT a new row (attempt + 1) rather than updating, so nothing else needs
--    to move a finalized score.
--
--    This does NOT stop a student submitting an inflated score in the first
--    place. That requires grading server-side against the answer key; see the
--    note left for the maintainers.
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
    NEW.score      := OLD.score;
    NEW.kept_score := OLD.kept_score;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_finalized_quiz_score ON public.quiz_submissions;
CREATE TRIGGER freeze_finalized_quiz_score
  BEFORE UPDATE ON public.quiz_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_finalized_quiz_score();

-- 3. quiz_attempts: written once by QuizTaker via INSERT and never updated by
--    the app, so any UPDATE of score is illegitimate for a non-staff caller.
CREATE OR REPLACE FUNCTION public.freeze_quiz_attempt_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  NEW.score := OLD.score;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_quiz_attempt_score ON public.quiz_attempts;
CREATE TRIGGER freeze_quiz_attempt_score
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_quiz_attempt_score();

-- 4. Anonymous callers have no legitimate write path to any of these tables.
--    RLS already blocks them (auth.uid() is null), but the standing grant is
--    unnecessary surface area. career_quiz_attempts is a different table and is
--    deliberately untouched.
REVOKE INSERT, UPDATE ON public.quiz_submissions       FROM anon;
REVOKE INSERT, UPDATE ON public.assignment_submissions FROM anon;
REVOKE INSERT, UPDATE ON public.quiz_attempts          FROM anon;
REVOKE INSERT, UPDATE ON public.grades                 FROM anon;
