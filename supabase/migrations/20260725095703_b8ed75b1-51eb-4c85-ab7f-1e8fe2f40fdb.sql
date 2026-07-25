-- Drop debug helper
DROP FUNCTION IF EXISTS public.debug_module_insert(uuid);

-- MODULES: replace policies with direct predicates
DROP POLICY IF EXISTS "Instructors can insert modules" ON public.modules;
DROP POLICY IF EXISTS "Instructors can update modules" ON public.modules;
DROP POLICY IF EXISTS "Instructors can delete modules" ON public.modules;

CREATE POLICY "Instructors can insert modules"
  ON public.modules FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
  );

CREATE POLICY "Instructors can update modules"
  ON public.modules FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
  );

CREATE POLICY "Instructors can delete modules"
  ON public.modules FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = modules.course_id AND c.instructor_id = auth.uid())
  );

-- CONTENT_ITEMS: same treatment
DROP POLICY IF EXISTS "Instructors can insert content items" ON public.content_items;
DROP POLICY IF EXISTS "Instructors can update content items" ON public.content_items;
DROP POLICY IF EXISTS "Instructors can delete content items" ON public.content_items;

CREATE POLICY "Instructors can insert content items"
  ON public.content_items FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
  );

CREATE POLICY "Instructors can update content items"
  ON public.content_items FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = content_items.course_id AND c.instructor_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
  );

CREATE POLICY "Instructors can delete content items"
  ON public.content_items FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = content_items.course_id AND c.instructor_id = auth.uid())
  );