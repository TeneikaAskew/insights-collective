-- Create question_banks table
CREATE TABLE IF NOT EXISTS question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_shared BOOLEAN DEFAULT false, -- Whether this bank is shared across courses
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create question_bank_questions table
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
  rich_content JSONB, -- For storing rich text/media content
  points DECIMAL(5,2) DEFAULT 1,
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  topic_tags TEXT[], -- Array of topic tags
  options JSONB, -- Answer options (varies by question type)
  correct_answer JSONB, -- Correct answer(s)
  explanation TEXT,
  feedback JSONB, -- Per-answer feedback for some question types
  usage_count INTEGER DEFAULT 0, -- Track how many times used
  success_rate DECIMAL(3,2), -- Average success rate (0-1)
  metadata JSONB, -- Additional metadata (e.g., bloom's taxonomy level)
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

-- Create quiz_question_pools table for random question selection
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

-- Create table to track which questions were used in specific quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank_questions(id),
  question_order INTEGER NOT NULL,
  student_answer JSONB,
  is_correct BOOLEAN,
  points_earned DECIMAL(5,2),
  time_spent INTEGER, -- seconds
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_question_banks_course ON question_banks(course_id);
CREATE INDEX idx_question_bank_questions_bank ON question_bank_questions(bank_id);
CREATE INDEX idx_question_bank_questions_type ON question_bank_questions(question_type);
CREATE INDEX idx_question_bank_questions_difficulty ON question_bank_questions(difficulty_level);
CREATE INDEX idx_question_bank_questions_tags ON question_bank_questions USING GIN(topic_tags);
CREATE INDEX idx_quiz_question_pools_quiz ON quiz_question_pools(quiz_id);
CREATE INDEX idx_quiz_attempt_questions_attempt ON quiz_attempt_questions(attempt_id);

-- RLS Policies
ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_question_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempt_questions ENABLE ROW LEVEL SECURITY;

-- Question Banks policies
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
      SELECT 1 FROM course_enrollments ce
      WHERE ce.course_id = question_banks.course_id
      AND ce.user_id = auth.uid()
    )
  );

-- Question Bank Questions policies
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

-- Categories policies
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

-- Question pools policies
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

-- Quiz attempt questions policies
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

-- Function to update question usage statistics
CREATE OR REPLACE FUNCTION update_question_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update usage count and success rate
  UPDATE question_bank_questions
  SET 
    usage_count = usage_count + 1,
    success_rate = (
      SELECT AVG(CASE WHEN is_correct THEN 1 ELSE 0 END)::DECIMAL(3,2)
      FROM quiz_attempt_questions
      WHERE question_id = NEW.question_id
    ),
    updated_at = now()
  WHERE id = NEW.question_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating statistics
CREATE TRIGGER update_question_stats_after_answer
  AFTER INSERT OR UPDATE OF is_correct ON quiz_attempt_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_question_statistics();

-- Function to select random questions from a pool
CREATE OR REPLACE FUNCTION select_random_questions(
  p_bank_id UUID,
  p_category_id UUID DEFAULT NULL,
  p_count INTEGER DEFAULT 10,
  p_difficulty TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (question_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT qbq.id
  FROM question_bank_questions qbq
  LEFT JOIN question_category_links qcl ON qcl.question_id = qbq.id
  WHERE qbq.bank_id = p_bank_id
    AND (p_category_id IS NULL OR qcl.category_id = p_category_id)
    AND (p_difficulty IS NULL OR p_difficulty = 'mixed' OR qbq.difficulty_level = p_difficulty)
    AND (p_tags IS NULL OR qbq.topic_tags && p_tags)
  ORDER BY RANDOM()
  LIMIT p_count;
END;
$$ LANGUAGE plpgsql;