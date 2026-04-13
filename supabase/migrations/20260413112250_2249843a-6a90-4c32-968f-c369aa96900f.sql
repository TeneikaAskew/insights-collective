
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- System/admin can insert notifications for any user
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for fast lookup
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, is_read, created_at DESC);

-- Create progress_snapshots table
CREATE TABLE public.progress_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  completion_percentage NUMERIC NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.progress_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view their own snapshots
CREATE POLICY "Users can view own progress snapshots"
ON public.progress_snapshots FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- System can insert snapshots
CREATE POLICY "Service role can insert progress snapshots"
ON public.progress_snapshots FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX idx_progress_snapshots_user ON public.progress_snapshots(user_id, course_id, snapshot_date DESC);

-- Create a function to snapshot current progress for all enrollments
CREATE OR REPLACE FUNCTION public.snapshot_enrollment_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO progress_snapshots (user_id, course_id, completion_percentage, snapshot_date)
  SELECT user_id, course_id, COALESCE(completion_status, 0), CURRENT_DATE
  FROM enrollments
  WHERE user_id IS NOT NULL AND course_id IS NOT NULL
  ON CONFLICT (user_id, course_id, snapshot_date) DO UPDATE
  SET completion_percentage = EXCLUDED.completion_percentage;
END;
$$;
