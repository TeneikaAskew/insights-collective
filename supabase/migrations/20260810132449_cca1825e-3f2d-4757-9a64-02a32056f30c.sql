-- Removing feedback must not tell the student feedback was added.
--
-- notify_student_on_grade treated any change to rubric_scores as "rubric
-- feedback added", so an instructor clearing a rubric (NEW.rubric_scores IS
-- NULL) sent "Your instructor added rubric feedback on your submission." with
-- no rubric to open. Same class of bug on the grade path: unsetting grade/score
-- sent "Your submission was graded." Both are notifications that contradict the
-- row they point at. Notify on added/changed feedback only.
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
  v_has_feedback boolean;
BEGIN
  -- A rubric only counts as changed when there is still a rubric to read.
  IF NEW.rubric_scores IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_rubric_changed := true;
    ELSIF NEW.rubric_scores IS DISTINCT FROM OLD.rubric_scores THEN
      v_rubric_changed := true;
    END IF;
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

  -- Nothing for the student to look at: the change cleared every
  -- feedback-bearing column. Silence beats a notification that lies.
  v_has_feedback := NEW.grade IS NOT NULL
    OR NEW.score IS NOT NULL
    OR NEW.grader_comments IS NOT NULL
    OR NEW.rubric_scores IS NOT NULL;
  IF NOT v_has_feedback THEN
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

REVOKE EXECUTE ON FUNCTION public.notify_student_on_grade() FROM PUBLIC, anon, authenticated;
