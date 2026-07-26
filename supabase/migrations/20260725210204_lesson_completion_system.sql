-- Lesson-completion system, corrected for the live schema.
-- Supersedes the never-applied 20250715090000-canvas-style-course-enhancements.sql:
-- that file's assignment_submissions/student_id shape conflicts with the live
-- table (user_id/workflow_state), so these tables are created standalone and
-- keyed by user_id per the live convention.

CREATE TABLE IF NOT EXISTS public.lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  completion_method TEXT CHECK (completion_method IN ('manual', 'automatic', 'requirement_met')),
  UNIQUE (lesson_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.lesson_completion_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('view', 'participate', 'submit', 'minimum_score', 'mark_done')),
  requirement_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lesson_id, requirement_type)
);

-- View/access tracking for legacy lessons; lessonCompletionService.trackLessonView
-- upserts on (lesson_id, user_id).
CREATE TABLE IF NOT EXISTS public.content_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress_percentage NUMERIC DEFAULT 0,
  time_spent NUMERIC DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lesson_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_completions_user ON public.lesson_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson ON public.lesson_completions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completion_requirements_lesson ON public.lesson_completion_requirements(lesson_id);
CREATE INDEX IF NOT EXISTS idx_content_progress_user ON public.content_progress(user_id);

ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completion_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_progress ENABLE ROW LEVEL SECURITY;

-- Students manage their own completion rows.
CREATE POLICY "Users manage own lesson completions" ON public.lesson_completions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Instructors of the owning course can view completions.
CREATE POLICY "Course instructors view lesson completions" ON public.lesson_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.course_assignments ca ON ca.course_id = m.course_id
      WHERE l.id = lesson_completions.lesson_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    )
  );

-- Any signed-in user can read requirements (they gate lesson completion).
CREATE POLICY "Authenticated users read lesson requirements" ON public.lesson_completion_requirements
  FOR SELECT TO authenticated USING (true);

-- Instructors of the owning course manage requirements.
CREATE POLICY "Course instructors manage lesson requirements" ON public.lesson_completion_requirements
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.course_assignments ca ON ca.course_id = m.course_id
      WHERE l.id = lesson_completion_requirements.lesson_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    )
  );

-- Students manage their own view-tracking rows.
CREATE POLICY "Users manage own content progress" ON public.content_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
