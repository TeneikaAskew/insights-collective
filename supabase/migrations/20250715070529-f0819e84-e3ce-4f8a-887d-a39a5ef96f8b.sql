-- Create RLS policies for lessons table to allow instructors to manage lessons in their courses

-- Allow instructors to insert lessons for their own courses
CREATE POLICY "Instructors can insert lessons for their courses" 
ON public.lessons 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM modules m 
    JOIN courses c ON m.course_id = c.id 
    WHERE m.id = lessons.module_id 
    AND c.instructor_id = auth.uid()
  )
);

-- Allow instructors to update lessons for their own courses
CREATE POLICY "Instructors can update lessons for their courses" 
ON public.lessons 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM modules m 
    JOIN courses c ON m.course_id = c.id 
    WHERE m.id = lessons.module_id 
    AND c.instructor_id = auth.uid()
  )
);

-- Allow instructors to delete lessons for their own courses
CREATE POLICY "Instructors can delete lessons for their courses" 
ON public.lessons 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM modules m 
    JOIN courses c ON m.course_id = c.id 
    WHERE m.id = lessons.module_id 
    AND c.instructor_id = auth.uid()
  )
);