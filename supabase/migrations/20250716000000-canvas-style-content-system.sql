-- Migration to Canvas-style content management system
-- This removes content blocks and creates a unified content system

-- Create enum for content item types
CREATE TYPE content_item_type AS ENUM ('page', 'assignment', 'quiz', 'discussion', 'external_url', 'external_tool');

-- Create the main content items table (replaces content_blocks)
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  type content_item_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT, -- Rich HTML content from WYSIWYG editor
  position INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN DEFAULT false,
  
  -- Type-specific fields stored in JSONB
  settings JSONB DEFAULT '{}',
  
  -- Common fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT unique_position_per_module UNIQUE (module_id, position)
);

-- Create assignments table for assignment-specific data
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  points_possible DECIMAL(10,2),
  due_at TIMESTAMPTZ,
  unlock_at TIMESTAMPTZ,
  lock_at TIMESTAMPTZ,
  submission_types TEXT[] DEFAULT ARRAY['online_text_entry'],
  allowed_attempts INTEGER DEFAULT 1,
  peer_reviews BOOLEAN DEFAULT false,
  anonymous_peer_reviews BOOLEAN DEFAULT false,
  
  -- Grading
  grading_type TEXT DEFAULT 'points', -- points, percent, letter_grade, pass_fail
  grading_standard_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create quizzes table for quiz-specific data
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  quiz_type TEXT DEFAULT 'assignment', -- assignment, practice, survey
  points_possible DECIMAL(10,2),
  time_limit INTEGER, -- in minutes
  allowed_attempts INTEGER DEFAULT 1,
  shuffle_answers BOOLEAN DEFAULT false,
  shuffle_questions BOOLEAN DEFAULT false,
  require_lockdown_browser BOOLEAN DEFAULT false,
  require_lockdown_browser_for_results BOOLEAN DEFAULT false,
  one_question_at_a_time BOOLEAN DEFAULT false,
  cant_go_back BOOLEAN DEFAULT false,
  show_correct_answers BOOLEAN DEFAULT true,
  show_correct_answers_last_attempt BOOLEAN DEFAULT false,
  show_correct_answers_at TIMESTAMPTZ,
  hide_correct_answers_at TIMESTAMPTZ,
  
  -- Availability
  due_at TIMESTAMPTZ,
  unlock_at TIMESTAMPTZ,
  lock_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create quiz questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL, -- multiple_choice, true_false, short_answer, essay, matching, etc.
  question_text TEXT NOT NULL, -- Rich HTML content
  points DECIMAL(10,2) DEFAULT 1,
  position INTEGER NOT NULL,
  answers JSONB DEFAULT '[]', -- Array of possible answers with correctness flags
  correct_comments TEXT, -- Rich HTML feedback for correct answers
  incorrect_comments TEXT, -- Rich HTML feedback for incorrect answers
  neutral_comments TEXT, -- Rich HTML general feedback
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_question_position UNIQUE (quiz_id, position)
);

-- Create assignment submissions table
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  submission_type TEXT, -- online_text_entry, online_upload, etc.
  body TEXT, -- Rich HTML content for text submissions
  url TEXT, -- For URL submissions
  grade DECIMAL(10,2),
  score DECIMAL(10,2),
  excused BOOLEAN DEFAULT false,
  late BOOLEAN DEFAULT false,
  missing BOOLEAN DEFAULT false,
  workflow_state TEXT DEFAULT 'unsubmitted', -- unsubmitted, submitted, graded
  attempt INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_assignment_attempt UNIQUE (assignment_id, user_id, attempt)
);

-- Create quiz submissions table
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  submission_id UUID UNIQUE DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ, -- When the quiz must be submitted by
  attempt INTEGER DEFAULT 1,
  extra_attempts INTEGER DEFAULT 0,
  extra_time INTEGER DEFAULT 0, -- Extra time in minutes
  manually_unlocked BOOLEAN DEFAULT false,
  time_spent INTEGER, -- Time spent in seconds
  score DECIMAL(10,2),
  kept_score DECIMAL(10,2), -- Score to keep based on scoring policy
  workflow_state TEXT DEFAULT 'untaken', -- untaken, pending_review, complete
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_quiz_attempt UNIQUE (quiz_id, user_id, attempt)
);

-- Create quiz submission answers table
CREATE TABLE IF NOT EXISTS quiz_submission_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_submission_id UUID NOT NULL REFERENCES quiz_submissions(id) ON DELETE CASCADE,
  quiz_question_id UUID NOT NULL REFERENCES quiz_questions(id),
  answer_data JSONB NOT NULL, -- Flexible structure for different question types
  correct BOOLEAN,
  points DECIMAL(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create file attachments table for assignment submissions
CREATE TABLE IF NOT EXISTS submission_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  url TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update modules table to better support Canvas-style workflow
ALTER TABLE modules 
ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS completion_requirements JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS prerequisite_module_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS publish_final_grade BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;

-- Create module progressions table
CREATE TABLE IF NOT EXISTS module_progressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  workflow_state TEXT DEFAULT 'locked', -- locked, started, completed
  current_position INTEGER,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_module_progression UNIQUE (user_id, module_id)
);

-- Create content item progressions table
CREATE TABLE IF NOT EXISTS content_item_progressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  workflow_state TEXT DEFAULT 'unread', -- unread, read, completed
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_content_progression UNIQUE (user_id, content_item_id)
);

-- Migrate existing content blocks to content items
INSERT INTO content_items (
  id,
  course_id,
  module_id,
  type,
  title,
  content,
  position,
  published,
  settings,
  created_at,
  updated_at
)
SELECT 
  cb.id,
  m.course_id,
  cb.module_id,
  CASE 
    WHEN cb.block_type = 'assignment' THEN 'assignment'::content_item_type
    WHEN cb.block_type = 'quiz' THEN 'quiz'::content_item_type
    ELSE 'page'::content_item_type
  END,
  COALESCE(cb.title, 'Untitled'),
  cb.content,
  cb.position,
  true,
  COALESCE(cb.metadata, '{}'::jsonb),
  cb.created_at,
  cb.updated_at
FROM content_blocks cb
JOIN modules m ON cb.module_id = m.id
WHERE cb.lesson_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Migrate lesson content to content items
INSERT INTO content_items (
  course_id,
  module_id,
  type,
  title,
  content,
  position,
  published,
  created_at,
  updated_at
)
SELECT 
  m.course_id,
  l.module_id,
  'page'::content_item_type,
  l.title,
  -- Combine all content blocks for this lesson into one rich content
  STRING_AGG(cb.content, E'\n\n' ORDER BY cb.position),
  l.order_index,
  true,
  l.created_at,
  l.updated_at
FROM lessons l
JOIN modules m ON l.module_id = m.id
LEFT JOIN content_blocks cb ON cb.lesson_id = l.id
GROUP BY l.id, m.course_id, l.module_id, l.title, l.order_index, l.created_at, l.updated_at;

-- Create indexes for performance
CREATE INDEX idx_content_items_course_module ON content_items(course_id, module_id);
CREATE INDEX idx_content_items_type ON content_items(type);
CREATE INDEX idx_assignments_content_item ON assignments(content_item_id);
CREATE INDEX idx_quizzes_content_item ON quizzes(content_item_id);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX idx_assignment_submissions_assignment_user ON assignment_submissions(assignment_id, user_id);
CREATE INDEX idx_quiz_submissions_quiz_user ON quiz_submissions(quiz_id, user_id);
CREATE INDEX idx_module_progressions_user_module ON module_progressions(user_id, module_id);
CREATE INDEX idx_content_progressions_user_content ON content_item_progressions(user_id, content_item_id);

-- Create RLS policies
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_progressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_item_progressions ENABLE ROW LEVEL SECURITY;

-- Content items policies
CREATE POLICY "Users can view published content items in enrolled courses" ON content_items
  FOR SELECT USING (
    published = true AND
    EXISTS (
      SELECT 1 FROM course_enrollments ce
      WHERE ce.course_id = content_items.course_id
      AND ce.user_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can manage content items" ON content_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM course_instructors ci
      WHERE ci.course_id = content_items.course_id
      AND ci.user_id = auth.uid()
    )
  );

-- Assignment policies
CREATE POLICY "Users can view assignments in enrolled courses" ON assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      JOIN course_enrollments ce ON ce.course_id = ci.course_id
      WHERE ci.id = assignments.content_item_id
      AND ce.user_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can manage assignments" ON assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      JOIN course_instructors cins ON cins.course_id = ci.course_id
      WHERE ci.id = assignments.content_item_id
      AND cins.user_id = auth.uid()
    )
  );

-- Similar policies for other tables...

-- Create functions for content management
CREATE OR REPLACE FUNCTION create_content_item(
  p_course_id UUID,
  p_module_id UUID,
  p_type content_item_type,
  p_title TEXT,
  p_content TEXT,
  p_settings JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_content_item_id UUID;
  v_position INTEGER;
BEGIN
  -- Get the next position
  SELECT COALESCE(MAX(position), -1) + 1 INTO v_position
  FROM content_items
  WHERE module_id = p_module_id;
  
  -- Insert content item
  INSERT INTO content_items (
    course_id, module_id, type, title, content, position, settings, created_by
  ) VALUES (
    p_course_id, p_module_id, p_type, p_title, p_content, v_position, p_settings, auth.uid()
  ) RETURNING id INTO v_content_item_id;
  
  -- Create type-specific record if needed
  IF p_type = 'assignment' THEN
    INSERT INTO assignments (content_item_id) VALUES (v_content_item_id);
  ELSIF p_type = 'quiz' THEN
    INSERT INTO quizzes (content_item_id) VALUES (v_content_item_id);
  END IF;
  
  RETURN v_content_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update triggers
CREATE TRIGGER update_content_items_updated_at BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: After this migration, we should remove the old tables:
-- DROP TABLE IF EXISTS content_blocks CASCADE;
-- DROP TABLE IF EXISTS lessons CASCADE;
-- But we'll do this in a separate migration after confirming data integrity