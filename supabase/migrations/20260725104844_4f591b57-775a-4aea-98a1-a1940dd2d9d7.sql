
CREATE POLICY "Instructors can select assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignments.course_id AND c.instructor_id = auth.uid()
    )
  );
