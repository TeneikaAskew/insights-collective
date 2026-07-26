DROP POLICY IF EXISTS "Instructors can insert modules" ON public.modules;
CREATE POLICY "Instructors can insert modules"
  ON public.modules FOR INSERT TO authenticated
  WITH CHECK (true);