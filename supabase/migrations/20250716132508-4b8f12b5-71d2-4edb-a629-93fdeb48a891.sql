-- Fix RLS policies for content_items table to properly handle instructor/admin access

-- Drop existing policies
DROP POLICY IF EXISTS "Instructors can manage content items" ON content_items;
DROP POLICY IF EXISTS "Users can view published content items in enrolled courses" ON content_items;

-- Create updated policies
CREATE POLICY "Instructors can manage content items" ON content_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = content_items.course_id
    AND (
      c.instructor_id = auth.uid() OR
      is_course_instructor(auth.uid(), c.id) OR
      has_admin_access(auth.uid())
    )
  )
);

CREATE POLICY "Users can view content items for courses they have access to" ON content_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = content_items.course_id
    AND (
      -- Instructors and admins can see all content items
      c.instructor_id = auth.uid() OR
      is_course_instructor(auth.uid(), c.id) OR
      has_admin_access(auth.uid()) OR
      -- Students can only see published content items in enrolled courses
      (
        content_items.published = true AND
        EXISTS (
          SELECT 1 FROM enrollments e
          WHERE e.course_id = c.id AND e.user_id = auth.uid()
        )
      )
    )
  )
);