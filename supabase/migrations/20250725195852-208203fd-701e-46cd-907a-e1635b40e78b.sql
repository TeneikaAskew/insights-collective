-- Add missing comprehensive question banks system
-- Fix the table references and create complete structure

-- First, drop the simplified tables if they exist 
DROP TABLE IF EXISTS public.question_bank_questions CASCADE;
DROP TABLE IF EXISTS public.question_banks CASCADE;

-- Create comprehensive question_banks table (with proper references)
CREATE TABLE IF NOT EXISTS question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create comprehensive question_bank_questions table
CREATE TABLE IF NOT EXISTS question_bank_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN (
    'multiple_choice', 
    'true_false', 
    'short_answer', 
    'essay',
    'matching',
    'fill_blank',
    'ordering',
    'multiple_answer',
    'calculated'
  )),
  question_text TEXT NOT NULL,
  rich_content JSONB,
  points DECIMAL(5,2) DEFAULT 1,
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  topic_tags TEXT[],
  options JSONB,
  correct_answer JSONB,
  explanation TEXT,
  feedback JSONB,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create question_bank_categories table
CREATE TABLE IF NOT EXISTS question_bank_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES question_bank_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bank_id, name)
);

-- Create question_category_links table
CREATE TABLE IF NOT EXISTS question_category_links (
  question_id UUID NOT NULL REFERENCES question_bank_questions(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES question_bank_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, category_id)
);

-- Create quiz_question_pools table
CREATE TABLE IF NOT EXISTS quiz_question_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  category_id UUID REFERENCES question_bank_categories(id),
  number_of_questions INTEGER NOT NULL,
  points_per_question DECIMAL(5,2) DEFAULT 1,
  difficulty_filter TEXT CHECK (difficulty_filter IN ('easy', 'medium', 'hard', 'mixed')),
  topic_tags_filter TEXT[],
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create quiz_attempts table if it doesn't exist
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score DECIMAL(5,2),
  time_spent INTEGER,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quiz_id, attempt_number)
);

-- Create quiz_attempt_questions table
CREATE TABLE IF NOT EXISTS quiz_attempt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank_questions(id),
  question_order INTEGER NOT NULL,
  student_answer JSONB,
  is_correct BOOLEAN,
  points_earned DECIMAL(5,2),
  time_spent INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_question_banks_course ON question_banks(course_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_questions_bank ON question_bank_questions(bank_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_questions_type ON question_bank_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_question_bank_questions_difficulty ON question_bank_questions(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_question_bank_questions_tags ON question_bank_questions USING GIN(topic_tags);
CREATE INDEX IF NOT EXISTS idx_quiz_question_pools_quiz ON quiz_question_pools(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_questions_attempt ON quiz_attempt_questions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON quiz_attempts(user_id, quiz_id);

-- Enable RLS
ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_question_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempt_questions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies with correct table references
CREATE POLICY "Instructors can manage their course question banks" ON question_banks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM course_assignments ca
      WHERE ca.course_id = question_banks.course_id
      AND ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
    )
  );

CREATE POLICY "Students can view question banks for their courses" ON question_banks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = question_banks.course_id
      AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can manage questions in their banks" ON question_bank_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM question_banks qb
      JOIN course_assignments ca ON ca.course_id = qb.course_id
      WHERE qb.id = question_bank_questions.bank_id
      AND ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
    )
  );

CREATE POLICY "Students can view questions during quiz attempts" ON question_bank_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_attempt_questions qaq
      JOIN quiz_attempts qa ON qa.id = qaq.attempt_id
      WHERE qaq.question_id = question_bank_questions.id
      AND qa.user_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can manage categories" ON question_bank_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM question_banks qb
      JOIN course_assignments ca ON ca.course_id = qb.course_id
      WHERE qb.id = question_bank_categories.bank_id
      AND ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
    )
  );

CREATE POLICY "Category links follow question access" ON question_category_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM question_bank_questions qbq
      JOIN question_banks qb ON qb.id = qbq.bank_id
      JOIN course_assignments ca ON ca.course_id = qb.course_id
      WHERE qbq.id = question_category_links.question_id
      AND ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
    )
  );

CREATE POLICY "Instructors can manage question pools" ON quiz_question_pools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      JOIN content_items ci ON ci.id = q.content_item_id
      JOIN modules m ON m.id = ci.module_id
      JOIN course_assignments ca ON ca.course_id = m.course_id
      WHERE q.id = quiz_question_pools.quiz_id
      AND ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
    )
  );

CREATE POLICY "Users can manage their own quiz attempts" ON quiz_attempts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own attempt questions" ON quiz_attempt_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      WHERE qa.id = quiz_attempt_questions.attempt_id
      AND qa.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert attempt questions" ON quiz_attempt_questions
  FOR INSERT WITH CHECK (true);

-- Create updated_at triggers
CREATE TRIGGER update_question_banks_updated_at
  BEFORE UPDATE ON question_banks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_question_bank_questions_updated_at
  BEFORE UPDATE ON question_bank_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quiz_attempts_updated_at
  BEFORE UPDATE ON quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();