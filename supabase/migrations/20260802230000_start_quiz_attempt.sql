-- Allocate quiz attempt numbers in the database instead of in the browser.
--
-- THE BUG
--
-- CanvasQuizTaking read the student's highest submission, then inserted
-- `attempt + 1` from the client. Two pages that read before either writes
-- compute the SAME number, and `unique_user_quiz_attempt` on
-- (quiz_id, user_id, attempt) rejects the loser. A student with the quiz open
-- in two tabs, or who double-clicks Start, gets a constraint error instead of
-- an attempt. Found while removing a count-guard from the e2e suite, which had
-- been racing itself the same way.
--
-- THE SECOND BUG, FOUND WHILE FIXING THE FIRST
--
-- `allowed_attempts` was enforced ONLY by the React gate that decides whether
-- to render the Start button. The INSERT policy on quiz_submissions is
-- `auth.uid() = user_id` and nothing else, so anyone posting directly to
-- PostgREST could take a 3-attempt quiz any number of times. The limit is now
-- enforced where it cannot be skipped.
--
-- WHY SECURITY INVOKER
--
-- Deliberately NOT security definer. The function inserts a row the caller is
-- already allowed to insert under the existing RLS policy, so it needs no
-- elevated rights — and running as invoker means RLS still applies to every
-- statement inside it. A definer function here would widen what the caller can
-- do for no reason, and would have to re-implement the authorization it just
-- bypassed.
--
-- WHY AN ADVISORY LOCK
--
-- Computing MAX(attempt) + 1 is racy however it is written: two transactions
-- can both read before either commits, and the unique index then turns the race
-- into an error for one of them. The transaction-scoped advisory lock
-- serialises concurrent starts for one (quiz, user) pair only — it does not
-- block different students, or the same student on a different quiz — and it is
-- released automatically when the transaction ends, including on error.

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

  -- Serialise starts for this student on this quiz. Two arguments rather than
  -- one hashed string, so a (quiz, user) pair cannot collide with an unrelated
  -- pair that happens to hash the same.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_quiz_id::text, 0),
    hashtextextended(v_user::text, 0)
  );

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

COMMENT ON FUNCTION public.start_quiz_attempt(uuid) IS
  'Atomically allocates the next quiz attempt for the calling user and enforces allowed_attempts. Replaces a client-side MAX(attempt)+1 that raced itself between browser tabs.';

REVOKE ALL ON FUNCTION public.start_quiz_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(uuid) TO authenticated;
