
-- First, let's enhance the lessons table to be the primary content container
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content_blocks_count integer DEFAULT 0;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS estimated_duration integer DEFAULT 0; -- in minutes
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS completion_required boolean DEFAULT true;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS completion_criteria jsonb DEFAULT '{"type": "all_blocks"}'::jsonb;

-- Update content_blocks to reference lessons instead of modules directly
-- First add the lesson_id column
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE;

-- Create a lesson_progress table for tracking lesson completion
CREATE TABLE IF NOT EXISTS lesson_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  completion_percentage integer DEFAULT 0,
  time_spent integer DEFAULT 0, -- in seconds
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  last_accessed_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Enable RLS on lesson_progress
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for lesson_progress
CREATE POLICY "Users can view their own lesson progress" 
  ON lesson_progress 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lesson progress" 
  ON lesson_progress 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lesson progress" 
  ON lesson_progress 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Update content_progress to work with the new structure
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_lesson ON content_blocks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_content_progress_user_block ON content_progress(user_id, content_block_id);

-- Create a function to calculate lesson completion
CREATE OR REPLACE FUNCTION calculate_lesson_completion(lesson_id_param uuid, user_id_param uuid)
RETURNS TABLE(
  completed boolean,
  completion_percentage integer,
  total_blocks integer,
  completed_blocks integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_blocks_count integer;
  completed_blocks_count integer;
  completion_pct integer;
  is_completed boolean;
BEGIN
  -- Get total content blocks for this lesson
  SELECT COUNT(*) INTO total_blocks_count
  FROM content_blocks 
  WHERE lesson_id = lesson_id_param;
  
  -- Get completed blocks for this user/lesson
  SELECT COUNT(*) INTO completed_blocks_count
  FROM content_blocks cb
  JOIN content_progress cp ON cb.id = cp.content_block_id
  WHERE cb.lesson_id = lesson_id_param 
    AND cp.user_id = user_id_param 
    AND cp.completed = true;
  
  -- Calculate completion percentage
  IF total_blocks_count > 0 THEN
    completion_pct := ROUND((completed_blocks_count::decimal / total_blocks_count::decimal) * 100);
    is_completed := completion_pct >= 100;
  ELSE
    completion_pct := 0;
    is_completed := false;
  END IF;
  
  RETURN QUERY SELECT is_completed, completion_pct, total_blocks_count, completed_blocks_count;
END;
$$;
