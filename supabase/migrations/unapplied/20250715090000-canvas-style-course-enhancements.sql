-- Create assignment_submissions table for student submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('file_upload', 'text_entry', 'url', 'media_recording')),
  submission_data JSONB,
  submitted_at TIMESTAMPTZ,
  grade DECIMAL(5,2),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES profiles(id),
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignment_id, student_id, attempt_number)
);

-- Create grades table for comprehensive grading
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  grade_type TEXT NOT NULL CHECK (grade_type IN ('assignment', 'quiz', 'participation', 'final', 'midterm', 'other')),
  points_earned DECIMAL(8,2),
  points_possible DECIMAL(8,2),
  percentage DECIMAL(5,2),
  letter_grade TEXT,
  weight DECIMAL(5,2) DEFAULT 1.0,
  comments TEXT,
  graded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create rubrics table
CREATE TABLE IF NOT EXISTS rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create rubric_criteria table
CREATE TABLE IF NOT EXISTS rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points DECIMAL(5,2) NOT NULL,
  order_index INTEGER NOT NULL,
  levels JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create assignment_rubrics junction table
CREATE TABLE IF NOT EXISTS assignment_rubrics (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, rubric_id)
);

-- Create course_announcements table
CREATE TABLE IF NOT EXISTS course_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create module_prerequisites table
CREATE TABLE IF NOT EXISTS module_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  prerequisite_module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  prerequisite_type TEXT NOT NULL CHECK (prerequisite_type IN ('complete_module', 'minimum_score', 'submit_assignment', 'view_content')),
  requirement_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(module_id, prerequisite_module_id)
);

-- Create lesson_completion_requirements table
CREATE TABLE IF NOT EXISTS lesson_completion_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('view', 'participate', 'submit', 'minimum_score', 'mark_done')),
  requirement_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lesson_id, requirement_type)
);

-- Create lesson_completions table
CREATE TABLE IF NOT EXISTS lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  completion_method TEXT CHECK (completion_method IN ('manual', 'automatic', 'requirement_met')),
  UNIQUE(lesson_id, student_id)
);

-- Add new columns to existing tables
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS submission_types TEXT[] DEFAULT ARRAY['file_upload'],
ADD COLUMN IF NOT EXISTS allowed_file_extensions TEXT[],
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS late_policy JSONB,
ADD COLUMN IF NOT EXISTS peer_review_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS peer_review_due_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS anonymous_grading BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS grading_type TEXT DEFAULT 'points' CHECK (grading_type IN ('points', 'percentage', 'complete_incomplete', 'letter_grade', 'gpa_scale', 'not_graded'));

ALTER TABLE modules
ADD COLUMN IF NOT EXISTS unlock_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS prerequisites_met BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS completion_requirements JSONB DEFAULT '[]';

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS unlock_at TIMESTAMPTZ;

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS grading_scheme JSONB,
ADD COLUMN IF NOT EXISTS late_policy JSONB,
ADD COLUMN IF NOT EXISTS time_zone TEXT DEFAULT 'UTC';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_course_student ON grades(course_id, student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_student ON lesson_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_course_announcements_course ON course_announcements(course_id);

-- Enable RLS
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_completion_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignment_submissions
CREATE POLICY "Students can view their own submissions" ON assignment_submissions
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Instructors can view all submissions in their courses" ON assignment_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN course_assignments ca ON a.course_id = ca.course_id
      WHERE a.id = assignment_submissions.assignment_id
      AND ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
    )
  );

CREATE POLICY "Students can create and update their own submissions" ON assignment_submissions
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Instructors can update submissions in their courses" ON assignment_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN course_assignments ca ON a.course_id = ca.course_id
      WHERE a.id = assignment_submissions.assignment_id
      AND ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
    )
  );

-- RLS Policies for grades
CREATE POLICY "Students can view their own grades" ON grades
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Instructors can manage grades in their courses" ON grades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM course_assignments
      WHERE course_id = grades.course_id
      AND user_id = auth.uid()
      AND role IN ('instructor', 'assistant')
    )
  );

-- RLS Policies for course_announcements
CREATE POLICY "Anyone can view announcements in enrolled courses" ON course_announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_enrollments
      WHERE course_id = course_announcements.course_id
      AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM course_assignments
      WHERE course_id = course_announcements.course_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can manage announcements" ON course_announcements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM course_assignments
      WHERE course_id = course_announcements.course_id
      AND user_id = auth.uid()
      AND role IN ('instructor', 'assistant')
    )
  );

-- RLS Policies for lesson_completions
CREATE POLICY "Students can manage their own completions" ON lesson_completions
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Instructors can view completions in their courses" ON lesson_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN modules m ON l.module_id = m.id
      JOIN course_assignments ca ON m.course_id = ca.course_id
      WHERE l.id = lesson_completions.lesson_id
      AND ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
    )
  );

-- Functions for progress calculation
CREATE OR REPLACE FUNCTION calculate_module_progress(p_module_id UUID, p_student_id UUID)
RETURNS TABLE (
  total_lessons INTEGER,
  completed_lessons INTEGER,
  total_assignments INTEGER,
  completed_assignments INTEGER,
  total_quizzes INTEGER,
  completed_quizzes INTEGER,
  progress_percentage DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH lesson_stats AS (
    SELECT 
      COUNT(DISTINCT l.id) as total_lessons,
      COUNT(DISTINCT lc.lesson_id) as completed_lessons
    FROM lessons l
    LEFT JOIN lesson_completions lc ON l.id = lc.lesson_id AND lc.student_id = p_student_id
    WHERE l.module_id = p_module_id
  ),
  assignment_stats AS (
    SELECT 
      COUNT(DISTINCT a.id) as total_assignments,
      COUNT(DISTINCT CASE WHEN asub.status = 'graded' THEN a.id END) as completed_assignments
    FROM assignments a
    LEFT JOIN assignment_submissions asub ON a.id = asub.assignment_id AND asub.student_id = p_student_id
    WHERE a.module_id = p_module_id
  ),
  quiz_stats AS (
    SELECT 
      COUNT(DISTINCT q.id) as total_quizzes,
      COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN q.id END) as completed_quizzes
    FROM quizzes q
    LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.user_id = p_student_id
    WHERE q.module_id = p_module_id
  )
  SELECT 
    ls.total_lessons,
    ls.completed_lessons,
    ast.total_assignments,
    ast.completed_assignments,
    qs.total_quizzes,
    qs.completed_quizzes,
    CASE 
      WHEN (ls.total_lessons + ast.total_assignments + qs.total_quizzes) = 0 THEN 100
      ELSE ROUND(
        (ls.completed_lessons + ast.completed_assignments + qs.completed_quizzes)::DECIMAL / 
        (ls.total_lessons + ast.total_assignments + qs.total_quizzes) * 100, 
        2
      )
    END as progress_percentage
  FROM lesson_stats ls, assignment_stats ast, quiz_stats qs;
END;
$$ LANGUAGE plpgsql;

-- Function to check if student has completed a course
CREATE OR REPLACE FUNCTION check_course_completion(p_course_id UUID, p_student_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_total_modules INTEGER;
  v_completed_modules INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_modules
  FROM modules
  WHERE course_id = p_course_id;
  
  SELECT COUNT(*) INTO v_completed_modules
  FROM modules m
  WHERE m.course_id = p_course_id
  AND (
    SELECT progress_percentage 
    FROM calculate_module_progress(m.id, p_student_id)
  ) = 100;
  
  RETURN v_total_modules > 0 AND v_total_modules = v_completed_modules;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_assignment_submissions_updated_at
  BEFORE UPDATE ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grades_updated_at
  BEFORE UPDATE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rubrics_updated_at
  BEFORE UPDATE ON rubrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_announcements_updated_at
  BEFORE UPDATE ON course_announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();