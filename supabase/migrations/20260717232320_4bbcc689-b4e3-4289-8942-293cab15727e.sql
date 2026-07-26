
DROP POLICY IF EXISTS "Users can read content items" ON public.content_items;
CREATE POLICY "Users can read content items"
ON public.content_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.can_manage_course_content(auth.uid(), course_id)
  OR (published = true AND EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = content_items.course_id AND e.user_id = auth.uid()
  ))
);
