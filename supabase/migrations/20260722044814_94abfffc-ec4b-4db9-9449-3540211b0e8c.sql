CREATE POLICY "TEMP allow any authenticated to insert modules"
  ON public.modules
  FOR INSERT
  TO authenticated
  WITH CHECK (true);