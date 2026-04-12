-- Ensure course_announcements table exists (may already exist from earlier migration)
CREATE TABLE IF NOT EXISTS public.course_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If the table was created by an older migration with NOT NULL on author_id or content,
-- relax those constraints so inserting via created_by works.
ALTER TABLE public.course_announcements
  ALTER COLUMN author_id DROP NOT NULL,
  ALTER COLUMN content DROP NOT NULL;

-- Add created_by column if it doesn't exist yet
ALTER TABLE public.course_announcements
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_announcements_course_id
  ON public.course_announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_course_announcements_created_at
  ON public.course_announcements(created_at DESC);

-- updated_at trigger (create function if needed)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS course_announcements_updated_at ON public.course_announcements;
CREATE TRIGGER course_announcements_updated_at
  BEFORE UPDATE ON public.course_announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.course_announcements ENABLE ROW LEVEL SECURITY;

-- Drop any old broken policies that reference non-existent tables
DROP POLICY IF EXISTS "Anyone can view announcements in enrolled courses" ON public.course_announcements;
DROP POLICY IF EXISTS "Instructors can manage announcements" ON public.course_announcements;

-- New correct policies

-- Enrolled students and course instructor can read
CREATE POLICY "Users can view course announcements"
  ON public.course_announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = course_announcements.course_id
        AND enrollments.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_announcements.course_id
        AND courses.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND ('admin' = ANY(profiles.roles) OR 'instructor' = ANY(profiles.roles))
    )
  );

-- Course instructor or admin can insert
CREATE POLICY "Instructors can create announcements"
  ON public.course_announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_announcements.course_id
        AND courses.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY(profiles.roles)
    )
  );

-- Author or admin can update
CREATE POLICY "Authors can update their announcements"
  ON public.course_announcements FOR UPDATE
  USING (
    created_by = auth.uid()
    OR author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY(profiles.roles)
    )
  );

-- Author or admin can delete
CREATE POLICY "Authors can delete their announcements"
  ON public.course_announcements FOR DELETE
  USING (
    created_by = auth.uid()
    OR author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY(profiles.roles)
    )
  );
