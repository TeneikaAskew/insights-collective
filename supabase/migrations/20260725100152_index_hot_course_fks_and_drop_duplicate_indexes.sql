-- Reconstructed for repo/prod parity from schema_migrations.statements.
-- Applied directly to the hosted project (version 20260725100152); backfilled so a
-- fresh db build reproduces prod. Already recorded on prod, so db push skips it.

-- Covering indexes for foreign keys on the course-flow hot paths (flagged by
-- the performance advisor; these columns are filtered on every course page
-- load and inside RLS policies).
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments (course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_module_id ON public.assignments (module_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_user_id ON public.assignment_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON public.certificates (course_id);
CREATE INDEX IF NOT EXISTS idx_content_item_progressions_content_item_id ON public.content_item_progressions (content_item_id);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON public.courses (instructor_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_user_id ON public.quiz_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON public.lessons (module_id);
CREATE INDEX IF NOT EXISTS idx_module_content_module_id ON public.module_content (module_id);
CREATE INDEX IF NOT EXISTS idx_module_progressions_module_id ON public.module_progressions (module_id);
CREATE INDEX IF NOT EXISTS idx_forums_course_id ON public.forums (course_id);
CREATE INDEX IF NOT EXISTS idx_course_wishlists_course_id ON public.course_wishlists (course_id);

-- Duplicate indexes flagged by the advisor: identical definitions, drop one.
ALTER TABLE public.course_assignments DROP CONSTRAINT IF EXISTS course_assignments_user_course_unique;
DROP INDEX IF EXISTS public.course_assignments_user_course_unique;
ALTER TABLE public.portfolio DROP CONSTRAINT IF EXISTS portfolio_id_key;
DROP INDEX IF EXISTS public.portfolio_id_key;
