-- Close three gaps in 20260728000000_hide_quiz_answer_key.sql, all raised in
-- review on PR #20.

-- 1. Authoring access was gated on the global instructor/admin role only, and
--    SECURITY DEFINER bypasses RLS — so any instructor could pass another
--    instructor's quiz id and read its answer key. Scope it with the existing
--    can_manage_quiz predicate (which already encodes course ownership);
--    admins keep repo-wide access through that same predicate.
CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_authoring(p_quiz_id uuid)
RETURNS SETOF public.quiz_questions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_quiz(auth.uid(), p_quiz_id) THEN
    RAISE EXCEPTION 'Not authorized to read this quiz''s answer key';
  END IF;

  RETURN QUERY
    SELECT * FROM public.quiz_questions
    WHERE quiz_id = p_quiz_id
    ORDER BY "position" NULLS LAST, created_at;
END;
$$;

-- 2. Stripping `correct` unconditionally also stripped it from the
--    post-submission review, where showing the right answer is the point.
--    Reveal it only when the student has a finished attempt AND the quiz
--    allows it (quizzes.show_correct_answers), mirroring the explanation gate.
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
  v_reveal boolean;
BEGIN
  -- One lookup, reused per row: has this student finished an attempt, and does
  -- the quiz permit showing answers afterwards?
  SELECT
    EXISTS (
      SELECT 1 FROM public.quiz_submissions s
      WHERE s.quiz_id = p_quiz_id
        AND s.user_id = auth.uid()
        AND s.workflow_state = 'complete'
    )
    AND COALESCE((SELECT q.show_correct_answers FROM public.quizzes q WHERE q.id = p_quiz_id), true)
  INTO v_reveal;

  RETURN QUERY
    SELECT
      q.id,
      q.quiz_id,
      q.question_text::text,
      q.question_type::text,
      q.points,
      q."position",
      COALESCE(
        (
          SELECT jsonb_agg(
                   CASE
                     WHEN v_reveal THEN jsonb_build_object(
                       'id', opt->>'id', 'text', opt->>'text',
                       'correct', COALESCE((opt->>'correct')::boolean, false))
                     ELSE jsonb_build_object('id', opt->>'id', 'text', opt->>'text')
                   END
                   ORDER BY ord)
          FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(q.answers) = 'array' THEN q.answers ELSE '[]'::jsonb END
               ) WITH ORDINALITY AS t(opt, ord)
        ),
        '[]'::jsonb
      ) AS answers,
      CASE WHEN v_reveal THEN q.explanation ELSE NULL END AS explanation
    FROM public.quiz_questions q
    WHERE q.quiz_id = p_quiz_id
      AND public.can_access_quiz_question(auth.uid(), q.id)
    ORDER BY q."position" NULLS LAST, q.created_at;
END;
$$;

COMMENT ON FUNCTION public.get_quiz_questions_for_taking IS
  'Quiz questions for students. The correct flag and explanation are withheld until the student has a completed attempt and the quiz has show_correct_answers enabled. Grading happens in the score-quiz edge function.';

GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_taking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_authoring(uuid) TO authenticated;
