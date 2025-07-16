-- CRITICAL FIX: Ensure students cannot access unpublished content items
-- This is a security issue that needs immediate resolution

-- Drop existing policies
DROP POLICY IF EXISTS "Instructors can manage content items" ON content_items;
DROP POLICY IF EXISTS "Users can view content items for courses they have access to" ON content_items;

-- Create strict policies that properly filter unpublished content for students
CREATE POLICY "Instructors and admins can manage all content items" ON content_items
FOR ALL TO authenticated
USING (
  has_admin_access(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = content_items.course_id
    AND (
      c.instructor_id = auth.uid() OR
      is_course_instructor(auth.uid(), c.id)
    )
  )
);

-- CRITICAL: Students can ONLY see published content items
CREATE POLICY "Students can only view published content items in enrolled courses" ON content_items
FOR SELECT TO authenticated
USING (
  -- Admins and instructors can see all content items
  has_admin_access(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = content_items.course_id
    AND (
      c.instructor_id = auth.uid() OR
      is_course_instructor(auth.uid(), c.id)
    )
  ) OR
  -- Students can ONLY see published content items in enrolled courses
  (
    content_items.published = true AND
    EXISTS (
      SELECT 1 FROM courses c
      JOIN enrollments e ON c.id = e.course_id
      WHERE c.id = content_items.course_id
      AND e.user_id = auth.uid()
    )
  )
);