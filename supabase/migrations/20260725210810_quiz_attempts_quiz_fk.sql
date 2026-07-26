-- quiz_attempts.quiz_id has no foreign key in the live schema, so PostgREST
-- cannot embed quiz_attempts under quizzes (PGRST200) — the CourseProgress
-- page's quiz query 400s. Verified zero orphaned rows before adding.
ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_quiz_id_fkey
  FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);
