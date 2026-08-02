-- Fix the advisory lock in start_quiz_attempt: wrong overload, wrong hash.
--
-- 20260802230000 called pg_advisory_xact_lock(bigint, bigint). That overload
-- does not exist. Postgres offers pg_advisory_xact_lock(bigint) for a single
-- 64-bit key and pg_advisory_xact_lock(int, int) for a two-part key — and
-- hashtextextended() returns bigint, which matches neither of them in the
-- two-argument form.
--
-- So the previous version created cleanly, the migration reported success, and
-- the function would have raised 42883 on EVERY quiz start. Caught by exercising
-- the function rather than trusting the apply, which is the whole reason this
-- follow-up exists rather than a quiet edit of the original file: that version
-- is already in the ledger, so the repo has to show what actually happened.
--
-- hashtext() returns integer, which is the (int, int) overload's type. The
-- two-part key is kept deliberately: hashing the pair into one value would let
-- an unrelated (quiz, user) pair collide onto the same lock and serialise two
-- students who have nothing to do with each other.

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(p_quiz_id uuid)
RETURNS public.quiz_submissions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_allowed integer;
  v_last    integer;
  v_row     public.quiz_submissions;
BEGIN
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

  -- Serialise starts for this student on this quiz. Transaction-scoped, so it
  -- releases on commit OR error, and keyed on the pair so it never blocks a
  -- different student or a different quiz.
  PERFORM pg_advisory_xact_lock(hashtext(p_quiz_id::text), hashtext(v_user::text));

  SELECT MAX(attempt) INTO v_last
    FROM public.quiz_submissions
   WHERE quiz_id = p_quiz_id
     AND user_id = v_user;

  v_last := COALESCE(v_last, 0);

  -- NULL allowed_attempts means unlimited, matching how the UI reads it.
  IF v_allowed IS NOT NULL AND v_last >= v_allowed THEN
    RAISE EXCEPTION 'You have used all % attempts for this quiz.', v_allowed
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.quiz_submissions (quiz_id, user_id, started_at, attempt, workflow_state)
  VALUES (p_quiz_id, v_user, now(), v_last + 1, 'pending_review')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
