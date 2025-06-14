
-- Drop existing policies if they exist and recreate them properly
DO $$
BEGIN
  -- Drop existing policies for courses
  DROP POLICY IF EXISTS "Public can view published courses" ON courses;
  DROP POLICY IF EXISTS "Authenticated users can view all courses" ON courses;
  DROP POLICY IF EXISTS "Admins can manage all courses" ON courses;
  DROP POLICY IF EXISTS "Instructors can manage assigned courses" ON courses;
  
  -- Drop existing policies for course_assignments
  DROP POLICY IF EXISTS "Admins can manage course assignments" ON course_assignments;
  DROP POLICY IF EXISTS "Users can view their own assignments" ON course_assignments;
  
  -- Drop existing policies for enrollments
  DROP POLICY IF EXISTS "Users can view their own enrollments" ON enrollments;
  DROP POLICY IF EXISTS "Admins and instructors can view course enrollments" ON enrollments;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if policies don't exist
    NULL;
END;
$$;

-- Ensure the courses table has all necessary fields
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS enrollment_count integer DEFAULT 0;

-- Enable RLS on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for courses
CREATE POLICY "Public can view published courses" ON courses
  FOR SELECT USING (published = true);

CREATE POLICY "Authenticated users can view all courses" ON courses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage all courses" ON courses
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND 'admin' = ANY(profiles.roles)
    )
  );

CREATE POLICY "Instructors can manage assigned courses" ON courses
  FOR ALL TO authenticated 
  USING (
    instructor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM course_assignments 
      WHERE course_assignments.course_id = courses.id 
      AND course_assignments.user_id = auth.uid()
      AND course_assignments.role = 'instructor'
    )
  );

-- Create RLS policies for course_assignments
CREATE POLICY "Admins can manage course assignments" ON course_assignments
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND 'admin' = ANY(profiles.roles)
    )
  );

CREATE POLICY "Users can view their own assignments" ON course_assignments
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- Create RLS policies for enrollments
CREATE POLICY "Users can view their own enrollments" ON enrollments
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Admins and instructors can view course enrollments" ON enrollments
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND 'admin' = ANY(profiles.roles)
    ) OR
    EXISTS (
      SELECT 1 FROM course_assignments 
      WHERE course_assignments.course_id = enrollments.course_id 
      AND course_assignments.user_id = auth.uid()
      AND course_assignments.role = 'instructor'
    ) OR
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = enrollments.course_id 
      AND courses.instructor_id = auth.uid()
    )
  );

-- Create course instructors table for better instructor management
CREATE TABLE IF NOT EXISTS course_instructors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text DEFAULT 'instructor',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(course_id, user_id)
);

-- Enable RLS on course_instructors
ALTER TABLE course_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course instructors" ON course_instructors
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND 'admin' = ANY(profiles.roles)
    )
  );

CREATE POLICY "Users can view their instructor assignments" ON course_instructors
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- Create a function to get course statistics
CREATE OR REPLACE FUNCTION get_course_stats(course_id_param uuid)
RETURNS TABLE(
  enrollment_count bigint,
  completion_rate numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(e.id) as enrollment_count,
    CASE 
      WHEN COUNT(e.id) > 0 THEN 
        ROUND(AVG(e.completion_status), 2)
      ELSE 0
    END as completion_rate
  FROM enrollments e
  WHERE e.course_id = course_id_param;
END;
$$;
