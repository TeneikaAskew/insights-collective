-- PREPARED ON A BRANCH. Apply only through db-migrate.yml after review.
--
-- Published-quiz answer access. Three repairs, one file, so the key cannot be half-closed:
--
-- 1. Column grants on quiz_questions. 20260728000000_hide_quiz_answer_key replaced the table-wide SELECT for
--    `authenticated` with a key-free column list. 20260731000800_restore_missing_select_grants then read
--    has_table_privilege('authenticated', 'public.quiz_questions', 'SELECT') = false (true of a column-only
--    grant) as "no grant at all" and re-granted SELECT on the whole table, which brought answers,
--    correct_answer, explanation, feedback and options back to every caller that RLS lets see the row,
--    including enrolled learners. This restores the column list. No client path needs the key columns:
--      * learners take quizzes through get_quiz_questions_for_taking (SECURITY DEFINER);
--      * the quiz editor reads full rows through get_quiz_questions_for_authoring (SECURITY DEFINER,
--        gated on can_manage_quiz);
--      * score-quiz reads the key with the service role;
--      * the course outline embeds quiz_questions with an explicit key-free column list.
--    `options` is withheld too: legacy rows keep accepted answers there for free-response types.
--    INSERT, UPDATE and DELETE are unchanged (RLS still restricts them to the quiz's managers).
--
-- 2. get_quiz_questions_for_taking stops returning the option text of free-response questions
--    (fill_blank, short_answer, essay, matching and any unknown type) before the reveal point. For those
--    types the "options" are the accepted answers or the pairs, so stripping only the `correct` flag still
--    handed the learner the key. Choice types (multiple_choice, true_false, multiple_answers) keep their
--    option text, which they need to be answered. After the reveal point (finished every allowed attempt and
--    show_correct_answers on) nothing changes. Everything else in the function is the current body.
--
-- 3. Learner writes. quiz_submission_answers INSERT/UPDATE/DELETE only required owning the submission, so a
--    learner could rewrite or delete answers on an attempt that was already submitted and graded, and the
--    gradebook shows those rows. They now also require the attempt to be in progress (not 'complete', no
--    finished_at), the same rule the player uses (isAttemptInProgress). quiz_submissions UPDATE by a learner
--    could change attempt, timing and unlock fields (end_at, extra_time, extra_attempts, manually_unlocked,
--    started_at, finished_at, time_spent, attempt, submission_id). No client writes them; a new BEFORE UPDATE
--    trigger keeps the stored values for API callers who are not grading staff or service_role. Score,
--    workflow_state and identity were already pinned by earlier triggers and are untouched here.
--
-- Behavioural test: scripts/local-db/tests/10_quiz_answer_access.sql. Static check:
-- src/test/ci/quizAnswerAccessMigration.test.ts.

-- 1. quiz_questions: key-free column grant for authenticated, nothing for anon.
REVOKE SELECT ON public.quiz_questions FROM authenticated;
REVOKE SELECT ON public.quiz_questions FROM anon;
GRANT SELECT (
  id,
  quiz_id,
  question_text,
  question_type,
  points,
  "position",
  created_at
) ON public.quiz_questions TO authenticated;

-- 2. Taking path: option text only for choice types until the reveal point.
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
        -- Free-response and pairing types: the option text IS the key. Withhold it until the reveal point.
        WHEN NOT v_reveal
             AND q.question_type::text NOT IN ('multiple_choice', 'true_false', 'multiple_answers') THEN
          '[]'::jsonb
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
$function$;

-- 3a. quiz_submission_answers: learners write only to their own attempt while it is in progress.
--     Plain DROP POLICY (no IF EXISTS): a live name that differs fails the migration instead of leaving the old
--     wider policy in place as an OR peer of the new one.
DROP POLICY "Users can create their own quiz submission answers" ON public.quiz_submission_answers;
CREATE POLICY "Users can create their own quiz submission answers"
ON public.quiz_submission_answers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quiz_submissions qs
    WHERE qs.id = quiz_submission_answers.quiz_submission_id
      AND qs.user_id = auth.uid()
      AND qs.workflow_state IS DISTINCT FROM 'complete'
      AND qs.finished_at IS NULL
  )
);

DROP POLICY "Users can update their own quiz submission answers" ON public.quiz_submission_answers;
CREATE POLICY "Users can update their own quiz submission answers"
ON public.quiz_submission_answers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_submissions qs
    WHERE qs.id = quiz_submission_answers.quiz_submission_id
      AND qs.user_id = auth.uid()
      AND qs.workflow_state IS DISTINCT FROM 'complete'
      AND qs.finished_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quiz_submissions qs
    WHERE qs.id = quiz_submission_answers.quiz_submission_id
      AND qs.user_id = auth.uid()
      AND qs.workflow_state IS DISTINCT FROM 'complete'
      AND qs.finished_at IS NULL
  )
);

DROP POLICY "Users can delete their own quiz submission answers" ON public.quiz_submission_answers;
CREATE POLICY "Users can delete their own quiz submission answers"
ON public.quiz_submission_answers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_submissions qs
    WHERE qs.id = quiz_submission_answers.quiz_submission_id
      AND qs.user_id = auth.uid()
      AND qs.workflow_state IS DISTINCT FROM 'complete'
      AND qs.finished_at IS NULL
  )
);

-- 3b. quiz_submissions: attempt, timing and unlock fields are not the learner's to change.
CREATE OR REPLACE FUNCTION public.pin_quiz_submission_attempt_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
BEGIN
  -- Direct database sessions (no API claims), score-quiz and finalize (service_role) and grading staff keep full
  -- control. Every other API caller keeps the stored values.
  IF v_role IS NULL OR v_role = 'service_role' OR public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  NEW.attempt           := OLD.attempt;
  NEW.submission_id     := OLD.submission_id;
  NEW.started_at        := OLD.started_at;
  NEW.end_at            := OLD.end_at;
  NEW.finished_at       := OLD.finished_at;
  NEW.time_spent        := OLD.time_spent;
  NEW.extra_time        := OLD.extra_time;
  NEW.extra_attempts    := OLD.extra_attempts;
  NEW.manually_unlocked := OLD.manually_unlocked;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.pin_quiz_submission_attempt_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pin_quiz_submission_attempt_fields ON public.quiz_submissions;
CREATE TRIGGER pin_quiz_submission_attempt_fields
  BEFORE UPDATE ON public.quiz_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.pin_quiz_submission_attempt_fields();

-- Fail loudly if the key columns are still readable, rather than reporting success.
DO $$
DECLARE
  leaked text;
BEGIN
  SELECT string_agg(r || '.' || c, ', ' ORDER BY r, c) INTO leaked
  FROM unnest(ARRAY['anon', 'authenticated']) AS r,
       unnest(ARRAY['answers', 'correct_answer', 'explanation', 'feedback', 'options']) AS c
  WHERE has_column_privilege(r, 'public.quiz_questions', c, 'SELECT');

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'quiz_questions key columns still readable: %', leaked;
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.quiz_questions', 'question_text', 'SELECT') THEN
    RAISE EXCEPTION 'quiz_questions lost its key-free column grant';
  END IF;
END $$;
