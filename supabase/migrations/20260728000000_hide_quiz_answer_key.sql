-- Stop shipping the quiz answer key to the browser.
--
-- Scoring moved into the score-quiz edge function, so students no longer need
-- the `answers` / `correct_answer` columns at all — but they were still being
-- fetched: canvasContentService.getQuiz selects `quiz_questions(*)`, and the
-- answers JSONB carries {"id":..., "text":..., "correct": true}. Any student
-- could read the key in DevTools before answering.
--
-- RLS cannot fix this: it filters ROWS, and the key is a COLUMN on a row the
-- student is legitimately entitled to read. This is the same column-privilege
-- shape used for code_challenges.test_cases in 20260727000100.
--
-- Instructors author quizzes from the browser as `authenticated` too, so a
-- blanket REVOKE would break the quiz editor. They get the full row back
-- through a SECURITY DEFINER function gated on is_grading_staff().

-- 1. Students/anon lose the key columns; everything else stays readable.
REVOKE SELECT ON public.quiz_questions FROM authenticated;
REVOKE SELECT ON public.quiz_questions FROM anon;

GRANT SELECT (
  id,
  quiz_id,
  question_text,
  question_type,
  options,       -- legacy plain choice list; carries no correctness marker
  points,
  position,
  created_at
) ON public.quiz_questions TO authenticated;
-- Withheld: correct_answer, answers (the key), and explanation/feedback,
-- which routinely state why the right answer is right.

-- 2. Writes are unchanged: RLS (can_manage_quiz) already restricts who may
--    author questions, and the existing table-wide INSERT/UPDATE/DELETE grants
--    stay in place so the quiz editor keeps working.

-- 2b. Taking path: students still need the answer OPTIONS to answer — the
--     option text lives in the same JSONB as the `correct` flag. This returns
--     the questions with every option stripped of `correct` (and of any
--     `feedback`/`weight` hints), so the browser can render choices without
--     ever holding the key.
CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_taking(p_quiz_id uuid)
RETURNS TABLE (
  id uuid,
  quiz_id uuid,
  question_text text,
  -- question_type is varchar(20) on the table; cast below so the declared
  -- signature matches the query's actual output type.
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
BEGIN
  -- Reuse the existing row-level access predicate: only users who may see the
  -- quiz may see its questions.
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
          SELECT jsonb_agg(jsonb_build_object('id', opt->>'id', 'text', opt->>'text')
                           ORDER BY ord)
          FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(q.answers) = 'array' THEN q.answers ELSE '[]'::jsonb END
               ) WITH ORDINALITY AS t(opt, ord)
        ),
        '[]'::jsonb
      ) AS answers,
      -- Explanations often give the answer away, so they only appear once the
      -- student has a finished attempt (the post-submission review view).
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.quiz_submissions s
          WHERE s.quiz_id = q.quiz_id
            AND s.user_id = auth.uid()
            AND s.workflow_state = 'complete'
        ) THEN q.explanation
        ELSE NULL
      END AS explanation
    FROM public.quiz_questions q
    WHERE q.quiz_id = p_quiz_id
      AND public.can_access_quiz_question(auth.uid(), q.id)
    ORDER BY q.position NULLS LAST, q.created_at;
END;
$$;

COMMENT ON FUNCTION public.get_quiz_questions_for_taking IS
  'Quiz questions for students: answer options with the correct flag stripped. Grading happens in the score-quiz edge function.';

GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_taking(uuid) TO authenticated;

-- 3. Authoring path: instructors and admins read full rows, key included.
CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_authoring(p_quiz_id uuid)
RETURNS SETOF public.quiz_questions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_grading_staff() THEN
    RAISE EXCEPTION 'Not authorized to read quiz answer keys';
  END IF;

  RETURN QUERY
    SELECT * FROM public.quiz_questions
    WHERE quiz_id = p_quiz_id
    ORDER BY position NULLS LAST, created_at;
END;
$$;

COMMENT ON FUNCTION public.get_quiz_questions_for_authoring IS
  'Full quiz_questions rows (including the answers key) for instructors/admins. Students read the key-free column grant instead; scoring happens in the score-quiz edge function.';

GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_authoring(uuid) TO authenticated;

-- 4. Students may no longer write their own quiz scores at all. The trigger
--    from 20260727001000 froze scores only AFTER finalization, so the first
--    finalize write still accepted a browser-computed number. score-quiz uses
--    the service role and is unaffected by this.
CREATE OR REPLACE FUNCTION public.pin_quiz_submission_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new attempt starts ungraded; only score-quiz may set a score.
    NEW.score := NULL;
    NEW.kept_score := NULL;
    IF NEW.workflow_state = 'complete' THEN
      NEW.workflow_state := 'pending_review';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: the score and the finalized state are the server's to set.
  NEW.score := OLD.score;
  NEW.kept_score := OLD.kept_score;
  IF OLD.workflow_state = 'complete' THEN
    NEW.workflow_state := OLD.workflow_state;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pin_quiz_submission_score ON public.quiz_submissions;
CREATE TRIGGER pin_quiz_submission_score
  BEFORE INSERT OR UPDATE ON public.quiz_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.pin_quiz_submission_score();

-- 5. Per-answer correctness is likewise a server determination.
CREATE OR REPLACE FUNCTION public.pin_quiz_answer_grading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS pin_quiz_answer_grading ON public.quiz_submission_answers;
CREATE TRIGGER pin_quiz_answer_grading
  BEFORE INSERT OR UPDATE ON public.quiz_submission_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.pin_quiz_answer_grading();
