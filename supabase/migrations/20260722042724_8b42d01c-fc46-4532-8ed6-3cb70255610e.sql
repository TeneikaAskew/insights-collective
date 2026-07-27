
CREATE TABLE IF NOT EXISTS public.course_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'feedback',
  message TEXT NOT NULL,
  screenshot_url TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_feedback TO authenticated;
GRANT ALL ON public.course_feedback TO service_role;

ALTER TABLE public.course_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own feedback"
  ON public.course_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own feedback"
  ON public.course_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update feedback"
  ON public.course_feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete feedback"
  ON public.course_feedback FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS course_feedback_user_idx ON public.course_feedback(user_id);
CREATE INDEX IF NOT EXISTS course_feedback_course_idx ON public.course_feedback(course_id);
