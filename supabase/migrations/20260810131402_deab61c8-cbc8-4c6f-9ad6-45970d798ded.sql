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
  v_module_id uuid;
  v_assignment_id uuid;
  v_link text;
  v_is_update boolean := (TG_OP = 'UPDATE');
BEGIN
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

  SELECT s.user_id, a.title, a.course_id, a.module_id, a.id
    INTO v_student_id, v_assignment_title, v_course_id, v_module_id, v_assignment_id
  FROM public.assignment_submissions s
  JOIN public.assignments a ON a.id = s.assignment_id
  WHERE s.id = NEW.submission_id;

  IF v_student_id IS NULL OR v_student_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  v_link := CASE
    WHEN v_module_id IS NOT NULL THEN
      '/courses/' || v_course_id::text || '/modules/' || v_module_id::text
        || '/assignments/' || v_assignment_id::text
    ELSE '/courses/' || v_course_id::text || '/grades'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, course_id, link)
  VALUES (
    v_student_id,
    'submission_feedback',
    CASE WHEN v_is_update THEN 'Feedback updated: ' ELSE 'New feedback: ' END
      || COALESCE(v_assignment_title, 'Assignment'),
    CASE WHEN v_is_update
      THEN 'Your instructor updated their feedback on your submission.'
      ELSE 'Your instructor left feedback on your submission.' END,
    v_course_id,
    v_link
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_student_on_submission_comment() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_student_on_grade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_assignment_title text;
  v_module_id uuid;
  v_link text;
  v_rubric_changed boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.rubric_scores IS DISTINCT FROM OLD.rubric_scores THEN
    v_rubric_changed := true;
  ELSIF TG_OP = 'INSERT' AND NEW.rubric_scores IS NOT NULL THEN
    v_rubric_changed := true;
  END IF;

  IF NOT (
       (TG_OP = 'INSERT' AND (NEW.grade IS NOT NULL OR NEW.grader_comments IS NOT NULL OR NEW.score IS NOT NULL OR v_rubric_changed))
    OR (TG_OP = 'UPDATE' AND (
          NEW.grade IS DISTINCT FROM OLD.grade
          OR NEW.grader_comments IS DISTINCT FROM OLD.grader_comments
          OR NEW.score IS DISTINCT FROM OLD.score
          OR NEW.workflow_state IS DISTINCT FROM OLD.workflow_state
          OR v_rubric_changed
        ))
  ) THEN
    RETURN NEW;
  END IF;

  SELECT a.course_id, a.title, a.module_id INTO v_course_id, v_assignment_title, v_module_id
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  v_link := CASE
    WHEN v_module_id IS NOT NULL THEN
      '/courses/' || v_course_id::text || '/modules/' || v_module_id::text
        || '/assignments/' || NEW.assignment_id::text
    ELSE '/courses/' || v_course_id::text || '/grades'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, course_id, link)
  VALUES (
    NEW.user_id,
    CASE WHEN v_rubric_changed AND NEW.score IS NULL AND NEW.grade IS NULL
         THEN 'submission_feedback' ELSE 'assignment_graded' END,
    CASE WHEN v_rubric_changed AND NEW.score IS NULL AND NEW.grade IS NULL
         THEN 'Rubric feedback: ' || COALESCE(v_assignment_title, 'Assignment')
         ELSE 'Assignment graded: ' || COALESCE(v_assignment_title, 'Assignment') END,
    CASE
      WHEN v_rubric_changed AND NEW.score IS NULL AND NEW.grade IS NULL
        THEN 'Your instructor added rubric feedback on your submission.'
      WHEN NEW.score IS NOT NULL THEN 'Score: ' || NEW.score::text
      ELSE 'Your submission was graded.'
    END,
    v_course_id,
    v_link
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_student_on_grade() FROM PUBLIC, anon, authenticated;