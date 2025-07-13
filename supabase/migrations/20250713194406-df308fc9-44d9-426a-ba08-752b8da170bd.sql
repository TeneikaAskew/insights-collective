-- Step 1: Clean up roles data by merging role field into roles array (from previous migration)
UPDATE profiles 
SET roles = array_append(
  COALESCE(roles, ARRAY['student'::text]), 
  'admin'::text
)
WHERE role = 'admin' 
  AND (roles IS NULL OR NOT ('admin' = ANY(roles)));

UPDATE profiles 
SET roles = array_append(
  COALESCE(roles, ARRAY['student'::text]), 
  'instructor'::text
)
WHERE role = 'instructor' 
  AND (roles IS NULL OR NOT ('instructor' = ANY(roles)));

UPDATE profiles 
SET roles = ARRAY['student'::text]
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

UPDATE profiles 
SET roles = array_append(roles, 'student'::text)
WHERE NOT ('student' = ANY(roles));

-- Step 2: Update all RLS policies to use roles array instead of role field

-- Update page_visibility policies
DROP POLICY IF EXISTS "Only admins can update visibility settings" ON page_visibility;
DROP POLICY IF EXISTS "Only admins can insert visibility settings" ON page_visibility;

CREATE POLICY "Only admins can update visibility settings" ON page_visibility
FOR UPDATE USING ('admin' = ANY(get_user_roles(auth.uid())));

CREATE POLICY "Only admins can insert visibility settings" ON page_visibility  
FOR INSERT WITH CHECK ('admin' = ANY(get_user_roles(auth.uid())));

-- Update module_content policies
DROP POLICY IF EXISTS "Instructors can manage module content for assigned courses" ON module_content;
CREATE POLICY "Instructors can manage module content for assigned courses" ON module_content
FOR ALL USING ('instructor' = ANY(get_user_roles(auth.uid())) OR 'admin' = ANY(get_user_roles(auth.uid())));

-- Update storage.objects policies
DROP POLICY IF EXISTS "Instructors and admins can upload content" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their own uploads" ON storage.objects;

CREATE POLICY "Instructors and admins can upload content" ON storage.objects
FOR INSERT WITH CHECK (
  ('instructor' = ANY(get_user_roles(auth.uid())) OR 'admin' = ANY(get_user_roles(auth.uid())))
  AND bucket_id IN ('course-videos', 'course-documents', 'Course Materials', 'Module Content')
);

CREATE POLICY "Users can manage their own uploads" ON storage.objects
FOR ALL USING (
  auth.uid()::text = (storage.foldername(name))[1] 
  OR 'admin' = ANY(get_user_roles(auth.uid()))
);

-- Update courses policies  
DROP POLICY IF EXISTS "Only instructors can insert courses" ON courses;
CREATE POLICY "Only instructors can insert courses" ON courses
FOR INSERT WITH CHECK ('instructor' = ANY(get_user_roles(auth.uid())) OR 'admin' = ANY(get_user_roles(auth.uid())));

-- Update modules policies
DROP POLICY IF EXISTS "Instructors can insert modules for their courses" ON modules;
DROP POLICY IF EXISTS "Instructors can update modules for their courses" ON modules;
DROP POLICY IF EXISTS "Instructors can delete modules for their courses" ON modules;

CREATE POLICY "Instructors can insert modules for their courses" ON modules
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM courses WHERE id = modules.course_id AND instructor_id = auth.uid())
  OR 'admin' = ANY(get_user_roles(auth.uid()))
);

CREATE POLICY "Instructors can update modules for their courses" ON modules
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM courses WHERE id = modules.course_id AND instructor_id = auth.uid())
  OR 'admin' = ANY(get_user_roles(auth.uid()))
);

CREATE POLICY "Instructors can delete modules for their courses" ON modules  
FOR DELETE USING (
  EXISTS (SELECT 1 FROM courses WHERE id = modules.course_id AND instructor_id = auth.uid())
  OR 'admin' = ANY(get_user_roles(auth.uid()))
);

-- Update module_content policies
DROP POLICY IF EXISTS "Instructors can insert module content for their courses" ON module_content;
DROP POLICY IF EXISTS "Instructors can update module content for their courses" ON module_content;
DROP POLICY IF EXISTS "Instructors can delete module content for their courses" ON module_content;

CREATE POLICY "Instructors can insert module content for their courses" ON module_content
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM modules m JOIN courses c ON m.course_id = c.id 
          WHERE m.id = module_content.module_id AND c.instructor_id = auth.uid())
  OR 'admin' = ANY(get_user_roles(auth.uid()))
);

CREATE POLICY "Instructors can update module content for their courses" ON module_content
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM modules m JOIN courses c ON m.course_id = c.id 
          WHERE m.id = module_content.module_id AND c.instructor_id = auth.uid())
  OR 'admin' = ANY(get_user_roles(auth.uid()))
);

CREATE POLICY "Instructors can delete module content for their courses" ON module_content
FOR DELETE USING (
  EXISTS (SELECT 1 FROM modules m JOIN courses c ON m.course_id = c.id 
          WHERE m.id = module_content.module_id AND c.instructor_id = auth.uid())
  OR 'admin' = ANY(get_user_roles(auth.uid()))
);

-- Update forms policies
DROP POLICY IF EXISTS "Admins can do everything with forms" ON forms;
CREATE POLICY "Admins can do everything with forms" ON forms
FOR ALL USING ('admin' = ANY(get_user_roles(auth.uid())));

-- Update code_challenges policies
DROP POLICY IF EXISTS "Only admins can insert code challenges" ON code_challenges;
CREATE POLICY "Only admins can insert code challenges" ON code_challenges
FOR INSERT WITH CHECK ('admin' = ANY(get_user_roles(auth.uid())));

-- Step 3: Now we can safely drop the role column
ALTER TABLE profiles DROP COLUMN role;