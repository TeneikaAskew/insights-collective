
CREATE OR REPLACE FUNCTION public.notify_student_on_grade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_assignment_title text;
BEGIN
  IF NOT (
       (TG_OP = 'INSERT' AND (NEW.grade IS NOT NULL OR NEW.grader_comments IS NOT NULL OR NEW.score IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (
          NEW.grade IS DISTINCT FROM OLD.grade
          OR NEW.grader_comments IS DISTINCT FROM OLD.grader_comments
          OR NEW.score IS DISTINCT FROM OLD.score
          OR NEW.workflow_state IS DISTINCT FROM OLD.workflow_state
        ))
  ) THEN
    RETURN NEW;
  END IF;

  SELECT a.course_id, a.title INTO v_course_id, v_assignment_title
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, message, course_id, related_entity_id, related_entity_type)
  VALUES (
    NEW.user_id,
    'assignment_graded',
    'Assignment graded: ' || COALESCE(v_assignment_title, 'Assignment'),
    COALESCE('Score: ' || NEW.score::text, 'Your submission was graded.'),
    v_course_id,
    NEW.id,
    'assignment_submission'
  );
  RETURN NEW;
END;
$$;
