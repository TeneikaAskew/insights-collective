-- Reconstructed from the live database.
--
-- This migration and 20260728001000_scope_quiz_key_access.sql were applied
-- directly to project siuqvhscuiycvdrtiqsh without ever landing in this repo, so
-- a `supabase db push` from a clean checkout would have silently reverted them
-- and put the quiz answer key back on the wire. The statements below reproduce
-- the live state exactly and are safe to re-run.
--
-- The hole they close: `quiz_questions.correct_answer` and `.answers` (which
-- carries a `correct` flag per option) were selectable by any enrolled student,
-- so the answer key to every quiz was one PostgREST call away.

-- Table-level SELECT is withdrawn entirely, then granted back column by column.
-- A column-level grant is what makes `select('*')` fail loudly instead of
-- quietly returning the key.
REVOKE SELECT ON public.quiz_questions FROM anon, authenticated;

GRANT SELECT (
  id,
  quiz_id,
  question_text,
  question_type,
  options,
  points,
  "position",
  created_at
) ON public.quiz_questions TO authenticated;

-- Students read questions through this function instead. It returns the option
-- list with the `correct` flag stripped until the attempt is finished and the
-- quiz is configured to reveal answers.
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
$function$;

REVOKE EXECUTE ON FUNCTION public.get_quiz_questions_for_taking(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_taking(uuid) TO authenticated;
