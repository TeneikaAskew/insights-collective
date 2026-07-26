-- Restore the quiz_submissions -> quizzes foreign key.
--
-- Repo/prod drift reconciliation. This migration was applied directly to the
-- hosted project as part of the answer-key hotfix, but its SQL text was never
-- recorded in supabase_migrations.schema_migrations.statements, so the version
-- existed on prod (20260728002000) with no corresponding file in the repo. It is
-- reconstructed here from the resulting live constraint so that `supabase db push`
-- against a fresh or local database reproduces the same schema. The version is
-- already recorded on prod, so a push to prod skips this file — it only matters
-- for environments built from the repo.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.quiz_submissions
  DROP CONSTRAINT IF EXISTS quiz_submissions_quiz_id_fkey;

ALTER TABLE public.quiz_submissions
  ADD CONSTRAINT quiz_submissions_quiz_id_fkey
  FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
