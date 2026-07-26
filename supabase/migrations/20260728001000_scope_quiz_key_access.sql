-- Reconstructed from the live database — see the header of
-- 20260728000000_hide_quiz_answer_key.sql for why these were missing.
--
-- Instructors still need the answer key to author a quiz, and the column-level
-- revoke in the previous migration blocks them too. This gives them a scoped
-- way back in, and pins server-side grading so a student cannot write their own
-- score even though they can still insert an attempt.

CREATE OR REPLACE FUNCTION public.can_manage_quiz(viewer_id uuid, target_quiz_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = target_quiz_id
      AND public.can_manage_content_item(viewer_id, q.content_item_id)
  );
$function$;

-- Full rows, answer key included, for whoever may edit the quiz.
CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_authoring(p_quiz_id uuid)
RETURNS SETOF public.quiz_questions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_manage_quiz(auth.uid(), p_quiz_id) THEN
    RAISE EXCEPTION 'Not authorized to read this quiz''s answer key';
  END IF;

  RETURN QUERY
    SELECT * FROM public.quiz_questions
    WHERE quiz_id = p_quiz_id
    ORDER BY "position" NULLS LAST, created_at;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_quiz_questions_for_authoring(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_authoring(uuid) TO authenticated;

-- Grading is the server's to decide. These triggers let a student create and
-- update their own attempt rows while pinning every column that represents a
-- grade, so the only writer that matters is the score-quiz edge function
-- (service role, for which auth.uid() is null and is_grading_staff() is true).

CREATE OR REPLACE FUNCTION public.pin_quiz_answer_grading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.correct := false;
    NEW.points := 0;
  ELSE
    NEW.correct := OLD.correct;
    NEW.points := OLD.points;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.freeze_quiz_attempt_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  NEW.score := OLD.score;
  RETURN NEW;
END;
$function$;
