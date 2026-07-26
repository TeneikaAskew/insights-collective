-- Restore the missing quiz_submissions -> quizzes foreign key (PR #21 review).
--
-- quiz_submissions.quiz_id has no FK to quizzes.id — it was lost when quizzes
-- was recreated with CASCADE at some point. PostgREST derives embeds from
-- foreign keys, so `quizzes?select=...,quiz_submissions!left(...)` and the
-- reverse embed both fail with PGRST200 ("Could not find a relationship").
-- That blocks the module-progress fix in this PR and any future embed.
--
-- Verified safe before adding: zero orphan rows
--   SELECT count(*) FROM quiz_submissions s
--   LEFT JOIN quizzes q ON q.id = s.quiz_id
--   WHERE s.quiz_id IS NOT NULL AND q.id IS NULL;  -- 0
--
-- ON DELETE CASCADE matches quiz_submission_answers -> quiz_submissions:
-- deleting a quiz should not leave dangling submissions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quiz_submissions_quiz_id_fkey'
      AND conrelid = 'public.quiz_submissions'::regclass
  ) THEN
    ALTER TABLE public.quiz_submissions
      ADD CONSTRAINT quiz_submissions_quiz_id_fkey
      FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- quiz_attempts has the same gap and the same reason to exist; add it too so
-- the schema is consistent even though the app no longer reads that table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'quiz_attempts' AND relnamespace = 'public'::regnamespace)
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'quiz_attempts_quiz_id_fkey'
         AND conrelid = 'public.quiz_attempts'::regclass
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.quiz_attempts a
       LEFT JOIN public.quizzes q ON q.id = a.quiz_id
       WHERE a.quiz_id IS NOT NULL AND q.id IS NULL
     )
  THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_quiz_id_fkey
      FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
  END IF;
END
$$;
