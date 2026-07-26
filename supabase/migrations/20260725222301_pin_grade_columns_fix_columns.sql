-- Reconstructed for repo/prod parity from schema_migrations.statements.
-- Applied directly to the hosted project (version 20260725222301); backfilled so a
-- fresh db build reproduces prod. Already recorded on prod, so db push skips it.

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

  NEW.grade           := OLD.grade;
  NEW.score           := OLD.score;
  NEW.graded_at       := OLD.graded_at;
  NEW.grader_comments := OLD.grader_comments;
  NEW.rubric_scores   := OLD.rubric_scores;
  NEW.excused         := OLD.excused;
  NEW.late            := OLD.late;
  NEW.missing         := OLD.missing;
  RETURN NEW;
END;
$$;
