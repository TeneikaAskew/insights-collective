-- Fix RLS policies for lessons table to properly handle instructors and admins
DROP POLICY IF EXISTS "Instructors can insert lessons for their courses" ON public.lessons;
DROP POLICY IF EXISTS "Instructors can update lessons for their courses" ON public.lessons;
DROP POLICY IF EXISTS "Instructors can delete lessons for their courses" ON public.lessons;

-- Allow instructors and admins to insert lessons for courses they have access to
CREATE POLICY "Instructors and admins can insert lessons" 
ON public.lessons 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM modules m 
    JOIN courses c ON m.course_id = c.id 
    WHERE m.id = lessons.module_id 
    AND (
      c.instructor_id = auth.uid() OR
      EXISTS (
        SELECT 1 
        FROM course_assignments ca 
        WHERE ca.course_id = c.id 
        AND ca.user_id = auth.uid() 
        AND ca.role = 'instructor'
      ) OR
      'instructor' = ANY(get_user_roles(auth.uid())) OR
      'admin' = ANY(get_user_roles(auth.uid()))
    )
  )
);

-- Allow instructors and admins to update lessons for courses they have access to
CREATE POLICY "Instructors and admins can update lessons" 
ON public.lessons 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM modules m 
    JOIN courses c ON m.course_id = c.id 
    WHERE m.id = lessons.module_id 
    AND (
      c.instructor_id = auth.uid() OR
      EXISTS (
        SELECT 1 
        FROM course_assignments ca 
        WHERE ca.course_id = c.id 
        AND ca.user_id = auth.uid() 
        AND ca.role = 'instructor'
      ) OR
      'instructor' = ANY(get_user_roles(auth.uid())) OR
      'admin' = ANY(get_user_roles(auth.uid()))
    )
  )
);

-- Allow instructors and admins to delete lessons for courses they have access to
CREATE POLICY "Instructors and admins can delete lessons" 
ON public.lessons 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM modules m 
    JOIN courses c ON m.course_id = c.id 
    WHERE m.id = lessons.module_id 
    AND (
      c.instructor_id = auth.uid() OR
      EXISTS (
        SELECT 1 
        FROM course_assignments ca 
        WHERE ca.course_id = c.id 
        AND ca.user_id = auth.uid() 
        AND ca.role = 'instructor'
      ) OR
      'instructor' = ANY(get_user_roles(auth.uid())) OR
      'admin' = ANY(get_user_roles(auth.uid()))
    )
  )
);