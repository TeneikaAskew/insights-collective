-- Migration to Canvas-style content management system
-- This removes content blocks and creates a unified content system

-- Create enum for content item types
CREATE TYPE content_item_type AS ENUM ('page', 'assignment', 'quiz', 'discussion', 'external_url', 'external_tool');

-- Create the main content items table (replaces content_blocks)
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  graded_at TIMESTAMPTZ,
  grader_comments TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_assignment_attempt UNIQUE (assignment_id, user_id, attempt)
);

-- Create quiz submissions table
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  submission_id UUID UNIQUE DEFAULT gen_random_uuid(),
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

-- Add missing columns to existing tables
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

ALTER TABLE quizzes 
ADD COLUMN IF NOT EXISTS scoring_policy TEXT DEFAULT 'keep_highest';

-- Add missing columns to quiz_questions
ALTER TABLE quiz_questions 
ADD COLUMN IF NOT EXISTS feedback TEXT;

-- Update modules table to better support Canvas-style workflow
ALTER TABLE modules 
ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS completion_requirements JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS prerequisite_module_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS publish_final_grade BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;

-- Create module progressions table
CREATE TABLE IF NOT EXISTS module_progressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_items_course_module ON content_items(course_id, module_id);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(type);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_user ON assignment_submissions(assignment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_user ON quiz_submissions(quiz_id, user_id);
CREATE INDEX IF NOT EXISTS idx_module_progressions_user_module ON module_progressions(user_id, module_id);
CREATE INDEX IF NOT EXISTS idx_content_progressions_user_content ON content_item_progressions(user_id, content_item_id);

-- Create RLS policies
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_progressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_item_progressions ENABLE ROW LEVEL SECURITY;

-- Content items policies
CREATE POLICY "Users can view published content items in enrolled courses" ON content_items
  FOR SELECT USING (
    published = true AND
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = content_items.course_id
      AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can manage content items" ON content_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = content_items.course_id
      AND (c.instructor_id = auth.uid() OR 'instructor' = ANY(get_user_roles(auth.uid())) OR 'admin' = ANY(get_user_roles(auth.uid())))
    )
  );

-- Assignment submission policies
CREATE POLICY "Users can view their own assignment submissions" ON assignment_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assignment submissions" ON assignment_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assignment submissions" ON assignment_submissions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Instructors can manage assignment submissions" ON assignment_submissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN courses c ON a.course_id = c.id
      WHERE a.id = assignment_submissions.assignment_id
      AND (c.instructor_id = auth.uid() OR 'instructor' = ANY(get_user_roles(auth.uid())) OR 'admin' = ANY(get_user_roles(auth.uid())))
    )
  );

-- Update triggers
CREATE TRIGGER update_content_items_updated_at BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignment_submissions_updated_at BEFORE UPDATE ON assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quiz_submissions_updated_at BEFORE UPDATE ON quiz_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();