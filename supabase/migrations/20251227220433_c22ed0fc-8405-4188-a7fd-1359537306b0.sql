-- Add public read policy for modules to allow course preview
CREATE POLICY "Public can view published modules in published courses"
ON public.modules
FOR SELECT
TO public
USING (
  published = true 
  AND EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = modules.course_id 
    AND courses.published = true
  )
);