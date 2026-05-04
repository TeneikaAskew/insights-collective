-- Add course_id to events table so course-specific calendar events can be
-- created and filtered per course. Column is nullable so existing global
-- events (platform-level) are unaffected.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_events_course_id ON public.events(course_id);
