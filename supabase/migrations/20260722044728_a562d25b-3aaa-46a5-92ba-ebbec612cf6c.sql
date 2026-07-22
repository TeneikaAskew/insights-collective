-- Add a simple, direct INSERT policy that doesn't rely on SECURITY DEFINER helpers.
CREATE POLICY "Instructors can insert modules (direct)"
  ON public.modules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = modules.course_id
        AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );