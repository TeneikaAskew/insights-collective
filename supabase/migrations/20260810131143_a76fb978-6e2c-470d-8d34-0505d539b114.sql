-- 1) Include rubric feedback changes in the existing grade notification
CREATE OR REPLACE FUNCTION public.notify_student_on_grade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_assignment_title text;
BEGIN
  IF NOT (
       (TG_OP = 'INSERT' AND (NEW.grade IS NOT NULL OR NEW.grader_comments IS NOT NULL OR NEW.score IS NOT NULL OR NEW.rubric_scores IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (
          NEW.grade IS DISTINCT FROM OLD.grade
          OR NEW.grader_comments IS DISTINCT FROM OLD.grader_comments
          OR NEW.score IS DISTINCT FROM OLD.score
          OR NEW.workflow_state IS DISTINCT FROM OLD.workflow_state
          OR NEW.rubric_scores IS DISTINCT FROM OLD.rubric_scores
        ))
  ) THEN
    RETURN NEW;
  END IF;

  SELECT a.course_id, a.title INTO v_course_id, v_assignment_title
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, message, course_id)
  VALUES (
    NEW.user_id,
    'assignment_graded',
    'Assignment graded: ' || COALESCE(v_assignment_title, 'Assignment'),
    COALESCE('Score: ' || NEW.score::text, 'Your submission was graded.'),
    v_course_id
  );
  RETURN NEW;
END;
$function$;

-- 2) Notify the student when staff add or edit feedback comments
CREATE OR REPLACE FUNCTION public.notify_student_on_submission_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id uuid;
  v_assignment_title text;
  v_course_id uuid;
  v_is_update boolean := (TG_OP = 'UPDATE');
BEGIN
  -- Skip drafts, private notes and deleted comments
  IF COALESCE(NEW.is_draft, false) OR COALESCE(NEW.is_private, false) OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_is_update AND NOT (
       (COALESCE(OLD.is_draft, false) AND NOT COALESCE(NEW.is_draft, false))
    OR NEW.comment_text IS DISTINCT FROM OLD.comment_text
    OR NEW.rich_content IS DISTINCT FROM OLD.rich_content
  ) THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id, a.title, a.course_id
    INTO v_student_id, v_assignment_title, v_course_id
  FROM public.assignment_submissions s
  JOIN public.assignments a ON a.id = s.assignment_id
  WHERE s.id = NEW.submission_id;

  IF v_student_id IS NULL OR v_student_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, course_id)
  VALUES (
    v_student_id,
    'submission_feedback',
    CASE WHEN v_is_update THEN 'Feedback updated: ' ELSE 'New feedback: ' END
      || COALESCE(v_assignment_title, 'Assignment'),
    CASE WHEN v_is_update
      THEN 'Your instructor updated their feedback on your submission.'
      ELSE 'Your instructor left feedback on your submission.' END,
    v_course_id
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_student_on_submission_comment ON public.submission_comments;
CREATE TRIGGER trg_notify_student_on_submission_comment
AFTER INSERT OR UPDATE ON public.submission_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_student_on_submission_comment();