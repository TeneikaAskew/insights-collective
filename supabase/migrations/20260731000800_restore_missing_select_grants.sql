-- =====================================================================
-- FIX: three tables have RLS policies that can never run
-- =====================================================================
--
-- Background
-- ----------
-- public.enrollments, public.quiz_questions and public.code_challenges all
-- have RLS enabled and SELECT policies written explicitly `TO authenticated`:
--
--   enrollments     "Users can view their own enrollments", "enrollments_staff_select"
--   quiz_questions  "Instructors can select quiz_questions", "quiz_questions_student_select"
--   code_challenges "Anyone can view code challenges", "Authenticated users can read code challenges"
--
-- But the table-level SELECT grant is missing for anon/authenticated. Postgres
-- checks the GRANT before it consults RLS, so the request is refused with
--
--   42501  permission denied for table enrollments
--
-- and those policies are dead code — they describe an intent the database
-- never gets far enough to honour.
--
-- Confirmed against the live project: of every table in `public`, exactly
-- these three lack SELECT for `authenticated`, and all three have RLS on.
--
-- User-visible effect
-- -------------------
--   * enrollments     — a student cannot read their own enrollments, so
--                       "My Courses", progress and enrollment counts fail
--   * quiz_questions  — the quiz player cannot load its questions
--   * code_challenges — code practice cannot read the challenge and silently
--                       falls back to DEMO mode, presenting fake evaluation
--                       as though it were real
--
-- Why this is safe
-- ----------------
-- Granting SELECT does not widen row access. RLS is enabled on all three
-- tables and every policy above is restrictive (own rows, staff, enrolled
-- student). This grant only lets Postgres reach the policies that were
-- already written; the policies still decide which rows come back. This is
-- the standard Supabase arrangement: grant the role, then gate with RLS.
--
-- anon is granted only on code_challenges, which carries an explicit
-- "Anyone can view code challenges" policy for the public role. anon is
-- deliberately NOT granted on enrollments or quiz_questions.

GRANT SELECT ON public.enrollments     TO authenticated;
GRANT SELECT ON public.quiz_questions  TO authenticated;
GRANT SELECT ON public.code_challenges TO anon, authenticated;

-- Fail loudly if the grant did not take, rather than reporting success and
-- leaving the policies unreachable.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(t, ', ' ORDER BY t) INTO missing
  FROM (
    SELECT 'enrollments' AS t WHERE NOT has_table_privilege('authenticated', 'public.enrollments', 'SELECT')
    UNION ALL
    SELECT 'quiz_questions' WHERE NOT has_table_privilege('authenticated', 'public.quiz_questions', 'SELECT')
    UNION ALL
    SELECT 'code_challenges' WHERE NOT has_table_privilege('authenticated', 'public.code_challenges', 'SELECT')
  ) s;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'SELECT grant still missing for authenticated on: %', missing;
  END IF;

  RAISE NOTICE 'SELECT restored for authenticated on enrollments, quiz_questions, code_challenges.';
END $$;
