CREATE OR REPLACE FUNCTION public.notify_on_assignment_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_assignment_title text;
  v_module_title text;
  v_student_name text;
  v_is_resubmit boolean;
  v_where text;
  v_link text;
BEGIN
  IF NEW.workflow_state IS DISTINCT FROM 'submitted' OR NEW.submitted_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT (
       NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
    OR NEW.attempt IS DISTINCT FROM OLD.attempt
    OR NEW.workflow_state IS DISTINCT FROM OLD.workflow_state
  ) THEN
    RETURN NEW;
  END IF;

  SELECT a.course_id, a.title, m.title
    INTO v_course_id, v_assignment_title, v_module_title
  FROM public.assignments a
  LEFT JOIN public.content_items ci ON ci.id = a.content_item_id
  LEFT JOIN public.modules m ON m.id = ci.module_id
  WHERE a.id = NEW.assignment_id;

  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''), 'A student')
    INTO v_student_name
  FROM public.profiles p WHERE p.id = NEW.user_id;

  v_is_resubmit := COALESCE(NEW.attempt, 1) > 1;
  v_where := COALESCE(v_assignment_title, 'an assignment')
             || CASE WHEN v_module_title IS NOT NULL THEN ' (' || v_module_title || ')' ELSE '' END;
  v_link := '/courses/' || v_course_id || '/assignments';

  INSERT INTO public.notifications (user_id, type, title, message, link, course_id)
  SELECT staff.user_id,
         'assignment_submitted',
         CASE WHEN v_is_resubmit THEN 'Assignment resubmitted: ' ELSE 'New submission: ' END || COALESCE(v_assignment_title, 'Assignment'),
         COALESCE(v_student_name, 'A student')
           || CASE WHEN v_is_resubmit THEN ' resubmitted ' ELSE ' submitted ' END
           || v_where
           || CASE WHEN v_is_resubmit THEN ' (attempt ' || COALESCE(NEW.attempt, 1) || ').' ELSE '.' END,
         v_link,
         v_course_id
  FROM (
    SELECT ci.user_id AS user_id FROM public.course_instructors ci WHERE ci.course_id = v_course_id
    UNION
    SELECT c.instructor_id FROM public.courses c WHERE c.id = v_course_id AND c.instructor_id IS NOT NULL
  ) AS staff
  WHERE staff.user_id IS NOT NULL AND staff.user_id <> NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, course_id)
  VALUES (
    NEW.user_id,
    'assignment_submitted',
    CASE WHEN v_is_resubmit THEN 'Resubmission received: ' ELSE 'Submission received: ' END || COALESCE(v_assignment_title, 'Assignment'),
    'We received your work for ' || v_where || '. You will be notified when it is graded.',
    v_link,
    v_course_id
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_on_assignment_submission ON public.assignment_submissions;
CREATE TRIGGER trg_notify_on_assignment_submission
AFTER INSERT OR UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_assignment_submission();