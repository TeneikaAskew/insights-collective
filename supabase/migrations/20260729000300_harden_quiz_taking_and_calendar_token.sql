-- Forward fixes for issues found in review of the reconstructed quiz/answer-key
-- and calendar-token migrations. Those migrations reproduced the (buggy) live
-- state faithfully; this migration corrects the live state. Standard migration
-- discipline: the earlier migrations are left as the historical record and the
-- corrections land here.

-- ---------------------------------------------------------------------------
-- 1. get_quiz_questions_for_taking — two fixes
-- ---------------------------------------------------------------------------
-- (a) Answer-key leak on retakes. The previous predicate revealed the per-option
--     `correct` flag as soon as ONE completed submission existed. For a quiz with
--     allowed_attempts > 1 that means the second attempt loads with the full key.
--     Reveal only once the learner has no attempt left: allowed_attempts is a
--     positive number AND completed attempts have reached it. Unlimited attempts
--     (NULL / <= 0) never reveal during taking — the post-submission results from
--     score-quiz still tell the learner what they got right.
--     (Note: the schema has only `allowed_attempts` and `show_correct_answers`;
--     the dated reveal-window columns suggested in review do not exist here.)
-- (b) Legacy question format. Older questions store their choices in
--     `quiz_questions.options` as a plain string array with the key in
--     `correct_answer`, not in `answers`. The previous function only expanded
--     `answers`, so those questions returned `[]` and rendered no choices. Fall
--     back to `options`, using the option text as its id so string-match grading
--     in score-quiz keeps working, and only mark `correct` once reveal is allowed.
CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_taking(p_quiz_id uuid)
RETURNS TABLE (
  id uuid,
  quiz_id uuid,
  question_text text,
  question_type text,
  points integer,
  "position" integer,
  answers jsonb,
  explanation text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed integer;
  v_show boolean;
  v_completed integer;
  v_reveal boolean;
BEGIN
  SELECT q.allowed_attempts, COALESCE(q.show_correct_answers, true)
    INTO v_allowed, v_show
  FROM public.quizzes q
  WHERE q.id = p_quiz_id;

  SELECT count(*) INTO v_completed
  FROM public.quiz_submissions s
  WHERE s.quiz_id = p_quiz_id
    AND s.user_id = auth.uid()
    AND s.workflow_state = 'complete';

  v_reveal := v_show
    AND v_allowed IS NOT NULL
    AND v_allowed > 0
    AND v_completed >= v_allowed;

  RETURN QUERY
    SELECT
      q.id,
      q.quiz_id,
      q.question_text::text,
      q.question_type::text,
      q.points,
      q."position",
      CASE
        WHEN jsonb_typeof(q.answers) = 'array' AND jsonb_array_length(q.answers) > 0 THEN
          (
            SELECT jsonb_agg(
                     CASE
                       WHEN v_reveal THEN jsonb_build_object(
                         'id', opt->>'id', 'text', opt->>'text',
                         'correct', COALESCE((opt->>'correct')::boolean, false))
                       ELSE jsonb_build_object('id', opt->>'id', 'text', opt->>'text')
                     END
                     ORDER BY ord)
            FROM jsonb_array_elements(q.answers) WITH ORDINALITY AS t(opt, ord)
          )
        WHEN jsonb_typeof(q.options) = 'array' AND jsonb_array_length(q.options) > 0 THEN
          (
            SELECT jsonb_agg(
                     CASE
                       WHEN jsonb_typeof(opt) = 'object' THEN
                         CASE
                           WHEN v_reveal THEN jsonb_build_object(
                             'id', COALESCE(opt->>'id', opt->>'text'),
                             'text', opt->>'text',
                             'correct', COALESCE(
                               (opt->>'correct')::boolean,
                               lower(trim(COALESCE(opt->>'text',''))) = lower(trim(COALESCE(q.correct_answer,'')))))
                           ELSE jsonb_build_object(
                             'id', COALESCE(opt->>'id', opt->>'text'),
                             'text', opt->>'text')
                         END
                       ELSE
                         CASE
                           WHEN v_reveal THEN jsonb_build_object(
                             'id', opt #>> '{}', 'text', opt #>> '{}',
                             'correct', lower(trim(opt #>> '{}')) = lower(trim(COALESCE(q.correct_answer,''))))
                           ELSE jsonb_build_object('id', opt #>> '{}', 'text', opt #>> '{}')
                         END
                     END
                     ORDER BY ord)
            FROM jsonb_array_elements(q.options) WITH ORDINALITY AS t(opt, ord)
          )
        ELSE '[]'::jsonb
      END AS answers,
      CASE WHEN v_reveal THEN q.explanation ELSE NULL END AS explanation
    FROM public.quiz_questions q
    WHERE q.quiz_id = p_quiz_id
      AND public.can_access_quiz_question(auth.uid(), q.id)
    ORDER BY q."position" NULLS LAST, q.created_at;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Attach the pin_quiz_answer_grading trigger
-- ---------------------------------------------------------------------------
-- 20260728001000 defined pin_quiz_answer_grading() but never attached it, so on
-- a fresh build a learner could write their own `correct`/`points` onto their
-- answer rows. (The trigger already exists on the hosted project, applied
-- out-of-band; this makes the repo reproduce it. Idempotent.)
DROP TRIGGER IF EXISTS pin_quiz_answer_grading ON public.quiz_submission_answers;
CREATE TRIGGER pin_quiz_answer_grading
  BEFORE INSERT OR UPDATE ON public.quiz_submission_answers
  FOR EACH ROW EXECUTE FUNCTION public.pin_quiz_answer_grading();

-- ---------------------------------------------------------------------------
-- 3. calendar_feed_token was still readable by authenticated
-- ---------------------------------------------------------------------------
-- 20260729000100 only revoked the column from anon. authenticated kept a
-- table-level SELECT grant (a column REVOKE cannot subtract from it), and
-- enrollments_staff_select lets instructors/admins read other users' enrollment
-- rows — so the bearer token was readable. Revoke table SELECT and grant back
-- only the non-secret columns; owners still get their token through
-- get_my_calendar_feed_token() and the edge function through
-- resolve_calendar_feed_token(), both SECURITY DEFINER.
REVOKE SELECT ON public.enrollments FROM anon, authenticated;
GRANT SELECT (id, user_id, course_id, enrolled_at, completion_status)
  ON public.enrollments TO authenticated;
