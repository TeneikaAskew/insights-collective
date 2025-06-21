-- Add quiz attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  score INTEGER NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  time_taken INTEGER,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  certificate_type TEXT NOT NULL DEFAULT 'completion',
  certificate_data JSONB NOT NULL DEFAULT '{}',
  verification_code TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view their own quiz attempts" 
  ON quiz_attempts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quiz attempts" 
  ON quiz_attempts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own certificates" 
  ON certificates FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Instructors can issue certificates" 
  ON certificates FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses c 
      WHERE c.id = course_id 
      AND (
        c.instructor_id = auth.uid() 
        OR 'admin' = ANY(public.get_user_roles(auth.uid()))
      )
    )
  );