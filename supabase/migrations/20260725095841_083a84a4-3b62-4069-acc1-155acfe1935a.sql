-- Restore correct INSERT policy on modules
DROP POLICY IF EXISTS "Instructors can insert modules" ON public.modules;
CREATE POLICY "Instructors can insert modules"
  ON public.modules FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
  );

-- Add direct SELECT policy so RETURNING after INSERT works for instructors/admins
CREATE POLICY "Instructors can read their modules"
  ON public.modules FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
  );

-- Mirror for content_items so INSERT ... RETURNING works
CREATE POLICY "Instructors can read their content items"
  ON public.content_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = content_items.course_id AND c.instructor_id = auth.uid())
  );