-- Quiz-grading hardening on top of #20's server-side scoring.
--
-- #20 hid the answer key and moved scoring server-side, but left three gaps that
-- were found in review and are ALREADY APPLIED on the hosted project (they were
-- applied during the earlier security PR but dropped from that PR's repo diff to
-- avoid re-touching #20's quiz code). This migration formalizes them so the repo
-- reproduces prod and a future edit to these functions can't silently revert the
-- hardening. Each statement matches what is live; re-running is safe.
--
-- Not included here (already in #20): the answer-key REVOKE, the taking/authoring
-- RPC scaffolding, and the pin_quiz_answer_grading trigger.

-- ---------------------------------------------------------------------------
-- 1. get_quiz_questions_for_taking — withhold answers until retakes are done,
--    and support the legacy options-array question format.
-- ---------------------------------------------------------------------------
-- Reveal the per-option `correct` flag only once the learner has no attempt left
-- (allowed_attempts > 0 AND completed >= allowed_attempts); unlimited-attempt
-- quizzes never reveal during taking. Older questions store choices in
-- quiz_questions.options (a plain string array) with the key in correct_answer,
-- not in `answers`; fall back to `options`, using the option text as its id so
-- string-match grading keeps working, and only mark `correct` on reveal.
-- Signature is identical to #20's, so CREATE OR REPLACE applies cleanly.
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
-- 2. Learner reads their own graded answer rows (plain owner scope)
-- ---------------------------------------------------------------------------
-- quiz_submission_answers stores each learner's OWN submitted answers plus their
-- per-question correct/points. An earlier iteration tried to also withhold this
-- between attempts by making the rows invisible until attempts were exhausted,
-- but that gate did more harm than good:
--   * It checked the quiz-wide completed count, not the row's own submission, so
--     concurrent pending-but-graded submissions (score-quiz commits answer rows
--     before finalizing) became readable once any attempt hit the limit — the
--     very answer-oracle it was meant to close.
--   * The rows stay writable, so hiding them broke the clients' autosave upsert
--     and made both result views (CanvasQuizResults, InlineQuizPlayer) render
--     "0/N, all incorrect", contradicting the real score.
-- Revealing a learner their OWN correctness is standard formative-quiz behavior;
-- the answer KEY is still withheld during taking by get_quiz_questions_for_taking
-- (§1) and grading stays server-side. So this reverts to a plain owner scope,
-- matching the INSERT/UPDATE/DELETE policies already on this table. Instructors
-- keep their own separate policy.
DROP POLICY IF EXISTS "Users can view their own quiz submission answers" ON public.quiz_submission_answers;
CREATE POLICY "Users can view their own quiz submission answers" ON public.quiz_submission_answers
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_submissions qs
      WHERE qs.id = quiz_submission_answers.quiz_submission_id
        AND qs.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Atomic attempt-limit finalization
-- ---------------------------------------------------------------------------
-- score-quiz checked the completed-attempt count and finalized in separate round
-- trips, so N concurrent requests (each its own pending attempt row) could all
-- observe a sub-limit count and all finalize, exceeding allowed_attempts and
-- turning per-question results into an oracle. This serializes finalization per
-- (user, quiz) under a transaction advisory lock, re-checks the limit inside the
-- lock, writes the kept score, and reports whether answers may now be revealed.
-- Executed only by the score-quiz service-role client (EXECUTE revoked from
-- everyone), for which the grade-pinning triggers pass.
CREATE OR REPLACE FUNCTION public.finalize_quiz_submission(
  p_submission_id uuid,
  p_score integer,
  p_time_spent integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_quiz uuid;
  v_state text;
  v_allowed integer;
  v_show boolean;
  v_completed integer;
  v_reveal boolean;
BEGIN
  -- Read only the immutable routing columns first; they build the lock key.
  SELECT user_id, quiz_id
    INTO v_user, v_quiz
  FROM public.quiz_submissions
  WHERE id = p_submission_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user::text), hashtext(v_quiz::text));

  -- Re-read workflow_state INSIDE the lock. A concurrent finalize of this same
  -- submission may have completed it while we waited on the lock; reading state
  -- before the lock would let the loser re-finalize an already-complete row and
  -- return reveal:true off a stale count.
  SELECT workflow_state
    INTO v_state
  FROM public.quiz_submissions
  WHERE id = p_submission_id;

  IF v_state = 'complete' THEN
    RAISE EXCEPTION 'Attempt already submitted';
  END IF;

  SELECT allowed_attempts, COALESCE(show_correct_answers, true)
    INTO v_allowed, v_show
  FROM public.quizzes
  WHERE id = v_quiz;

  SELECT count(*) INTO v_completed
  FROM public.quiz_submissions
  WHERE quiz_id = v_quiz
    AND user_id = v_user
    AND workflow_state = 'complete';

  IF v_allowed IS NOT NULL AND v_allowed > 0 AND v_completed >= v_allowed THEN
    RAISE EXCEPTION 'Attempt limit reached';
  END IF;

  UPDATE public.quiz_submissions
  SET finished_at = now(),
      time_spent = p_time_spent,
      score = p_score,
      kept_score = p_score,
      workflow_state = 'complete'
  WHERE id = p_submission_id;

  v_reveal := v_show
    AND v_allowed IS NOT NULL
    AND v_allowed > 0
    AND (v_completed + 1) >= v_allowed;

  RETURN jsonb_build_object('reveal', v_reveal);
END;
$function$;

-- Only the score-quiz service-role client may finalize. Revoke the default
-- PUBLIC grant and the caller roles, then grant service_role explicitly so the
-- migration is self-contained on a fresh project (Supabase's default privileges
-- happen to grant service_role EXECUTE on creation, but do not rely on that).
REVOKE EXECUTE ON FUNCTION public.finalize_quiz_submission(uuid, integer, integer)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_quiz_submission(uuid, integer, integer)
  TO service_role;
