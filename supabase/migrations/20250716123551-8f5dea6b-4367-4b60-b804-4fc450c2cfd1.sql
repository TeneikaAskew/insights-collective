-- Create RLS policies for content_item_progressions table

-- Enable RLS on content_item_progressions (if not already enabled)
ALTER TABLE public.content_item_progressions ENABLE ROW LEVEL SECURITY;

-- Users can view their own content item progressions
CREATE POLICY "Users can view their own content item progressions" ON public.content_item_progressions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own content item progressions
CREATE POLICY "Users can insert their own content item progressions" ON public.content_item_progressions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own content item progressions
CREATE POLICY "Users can update their own content item progressions" ON public.content_item_progressions
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own content item progressions
CREATE POLICY "Users can delete their own content item progressions" ON public.content_item_progressions
  FOR DELETE USING (auth.uid() = user_id);

-- Instructors can view content item progressions for their courses
CREATE POLICY "Instructors can view content item progressions for their courses" ON public.content_item_progressions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON ci.course_id = c.id
      WHERE ci.id = content_item_progressions.content_item_id
      AND (
        c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );