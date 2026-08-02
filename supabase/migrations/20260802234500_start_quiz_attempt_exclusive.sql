-- Make start_quiz_attempt the ONLY way to create a quiz submission, and stop
-- treating allowed_attempts = 0 as "zero attempts".
--
-- TWO DEFECTS, BOTH MINE, BOTH FROM 20260802230000/231500.
--
-- 1. THE LIMIT WAS STILL SKIPPABLE. The previous migration moved the attempt
--    check into a function and left the INSERT policy from
--    20260412002000_quiz_submissions_bootstrap.sql untouched:
--
--        WITH CHECK (auth.uid() = user_id)
--
--    So an authenticated learner could POST straight to
--    /rest/v1/quiz_submissions and create unlimited pending attempts, never
--    touching the function that enforces the limit. The PR that introduced the
--    function claimed the limit was "enforced where it cannot be skipped". It
--    was not.
--
--    This is worth more than a tidiness fix: score-quiz upserts per-question
--    `is_correct` rows for a submission BEFORE finalize_quiz_submission rejects
--    an over-limit attempt, and those rows are readable by their owner. Enough
--    manufactured submissions and a learner can map the answer key of a quiz
--    they have exhausted.
--
--    The function therefore becomes SECURITY DEFINER and the permissive INSERT
--    policy is dropped. My own comment on the previous migration argued for
--    INVOKER on principle — that reasoning was sound in isolation and wrong for
--    the goal: a function cannot be the exclusive write path while it runs with
--    the caller's own rights, because whatever right lets IT insert lets the
--    caller insert directly too. Definer is what makes the difference between
--    the two paths real.
--
--    The function still grants nothing extra. It derives the user from
--    auth.uid() and refuses when that is null, writes user_id from that value
--    and never from an argument, and takes only a quiz id. So the authorization
--    is exactly the old policy's rule plus the limit the policy could not
--    express.
--
-- 2. allowed_attempts = 0 MEANS UNLIMITED HERE. Established by the functions
--    already in the database, both of which guard with `v_allowed > 0`:
--    finalize_quiz_submission and get_quiz_questions_for_taking. My version
--    checked only `IS NOT NULL`, so on a 0 = unlimited quiz `v_last >= 0` is
--    true on the very first start and the quiz could never be started at all.

-- Direct inserts are no longer permitted; the RPC below is the only path.
-- service_role still bypasses RLS, so the scoring Edge Function is unaffected.
DROP POLICY IF EXISTS "Users can create their own quiz submissions" ON public.quiz_submissions;

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(p_quiz_id uuid)
RETURNS public.quiz_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_allowed integer;
  v_last    integer;
  v_row     public.quiz_submissions;
BEGIN
  -- Definer runs as the owner, so this guard is load-bearing rather than
  -- decorative: without it an anonymous caller would insert with a null user.
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to start a quiz.'
      USING ERRCODE = '42501';
  END IF;

  SELECT allowed_attempts INTO v_allowed
    FROM public.quizzes
   WHERE id = p_quiz_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz not found.'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_quiz_id::text), hashtext(v_user::text));

  SELECT MAX(attempt) INTO v_last
    FROM public.quiz_submissions
   WHERE quiz_id = p_quiz_id
     AND user_id = v_user;

  v_last := COALESCE(v_last, 0);

  -- NULL or 0 both mean unlimited, matching finalize_quiz_submission and
  -- get_quiz_questions_for_taking.
  IF v_allowed IS NOT NULL AND v_allowed > 0 AND v_last >= v_allowed THEN
    RAISE EXCEPTION 'You have used all % attempts for this quiz.', v_allowed
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.quiz_submissions (quiz_id, user_id, started_at, attempt, workflow_state)
  VALUES (p_quiz_id, v_user, now(), v_last + 1, 'pending_review')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.start_quiz_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(uuid) TO authenticated;
