-- get_quiz_questions_for_taking throws 22P02 for every quiz, so no student has
-- ever seen an answer option in the inline player.
--
-- The live function on the project had drifted from this repo: something
-- redefined it with a legacy `options` fallback branch (the version in
-- 20260728001000 only reads `answers`). That rewrite compares an option's text
-- against the question's correct answer with
--
--     lower(trim(COALESCE(q.correct_answer, '')))
--
-- but quiz_questions.correct_answer is jsonb, so COALESCE resolves its untyped
-- '' literal to jsonb and Postgres folds the constant at parse time:
--
--     ERROR: 22P02 invalid input syntax for type json
--     DETAIL: The input string ended unexpectedly.
--
-- Constant folding means the branch never has to be taken — the function fails
-- for every question of every quiz, including the ones that store their choices
-- in `answers` and never reach the fallback at all.
--
-- InlineQuizPlayer swallows the error and falls back to `quiz.questions` from
-- the list query, which deliberately carries no answer data, so the player
-- renders the question text followed by "No options configured for this
-- question." — a quiz that cannot be answered.
--
-- Fix: extract the jsonb scalar to text with #>> '{}' before comparing. That
-- yields NULL for a JSON null and the bare string for a JSON string, so the
-- COALESCE default is a text '' and no json cast happens. Everything else is
-- preserved from the live definition, including the `options` fallback and the
-- attempts-based reveal rule.

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
SET search_path = public
AS $$
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

  -- The key stays hidden until the student has no attempts left to game.
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
        -- Preferred shape: answers = [{id, text, correct}, ...]
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
        -- Legacy shape: options = ["A", "B"] or [{id?, text}, ...], with the
        -- right choice named separately in correct_answer.
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
                               lower(trim(COALESCE(opt->>'text', ''))) =
                               lower(trim(COALESCE(q.correct_answer #>> '{}', '')))))
                           ELSE jsonb_build_object(
                             'id', COALESCE(opt->>'id', opt->>'text'),
                             'text', opt->>'text')
                         END
                       ELSE
                         CASE
                           WHEN v_reveal THEN jsonb_build_object(
                             'id', opt #>> '{}', 'text', opt #>> '{}',
                             'correct', lower(trim(COALESCE(opt #>> '{}', ''))) =
                                        lower(trim(COALESCE(q.correct_answer #>> '{}', ''))))
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
$$;

COMMENT ON FUNCTION public.get_quiz_questions_for_taking IS
  'Quiz questions for students, reading answers (preferred) or the legacy options column. The correct flag and explanation are withheld until the student has used every allowed attempt and the quiz has show_correct_answers enabled. Grading happens in the score-quiz edge function.';

GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_taking(uuid) TO authenticated;
