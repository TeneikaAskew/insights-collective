-- ABOUTME: start_quiz_attempt must refuse callers who cannot access the quiz. Today any signed-in
-- ABOUTME: account can create quiz_submissions for any quiz, published or not, in any course.
--
-- STATUS: PREPARED ON A BRANCH. NOT APPLIED TO PRODUCTION. Apply only through db-migrate.yml after review.
--
-- Evidence (local snapshot of the live schema, 2026-10-31, scripts/local-db/tests/03_start_quiz_attempt_authz.sql):
--   * start_quiz_attempt is SECURITY DEFINER and EXECUTE is granted to anon and authenticated.
--   * It checks only that auth.uid() is not null and the attempt limit. It never consults
--     can_access_quiz(), so an unenrolled student started attempts on a published AND an unpublished
--     quiz of a course they do not belong to. Anonymous callers are already refused.
--   * Since 20261031120009 a quiz_submissions row in pending_review satisfies the completion guard,
--     so this path also lets a non-enrolled account manufacture "assessment evidence".
--
-- Fix: reuse the existing can_access_quiz() predicate (admin, course owner, assigned instructor, or
-- enrolled learner on a published item). Behaviour for legitimate learners is unchanged; the
-- advisory lock, attempt limit and pending_review state are untouched. Additive-safe.

begin;

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(p_quiz_id uuid)
RETURNS public.quiz_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_allowed integer;
  v_last integer;
  v_row public.quiz_submissions;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to start a quiz.' USING ERRCODE = '42501';
  END IF;

  -- Definer runs as the owner, so RLS on quizzes does not protect this path. Ask the same
  -- predicate the quizzes/quiz_questions policies use.
  IF NOT public.can_access_quiz(v_user, p_quiz_id) THEN
    RAISE EXCEPTION 'You do not have access to this quiz.' USING ERRCODE = '42501';
  END IF;

  SELECT allowed_attempts INTO v_allowed FROM public.quizzes WHERE id = p_quiz_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_quiz_id::text), hashtext(v_user::text));

  SELECT MAX(attempt) INTO v_last FROM public.quiz_submissions WHERE quiz_id = p_quiz_id AND user_id = v_user;
  v_last := COALESCE(v_last, 0);

  -- NULL or 0 both mean unlimited, matching finalize_quiz_submission and get_quiz_questions_for_taking.
  IF v_allowed IS NOT NULL AND v_allowed > 0 AND v_last >= v_allowed THEN
    RAISE EXCEPTION 'You have used all % attempts for this quiz.', v_allowed USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.quiz_submissions (quiz_id, user_id, started_at, attempt, workflow_state)
  VALUES (p_quiz_id, v_user, now(), v_last + 1, 'pending_review')
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

-- Anonymous callers are refused inside the function already; drop the grant so the refusal is
-- not even reachable from the anon key.
REVOKE EXECUTE ON FUNCTION public.start_quiz_attempt(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(uuid) TO authenticated, service_role;

commit;
