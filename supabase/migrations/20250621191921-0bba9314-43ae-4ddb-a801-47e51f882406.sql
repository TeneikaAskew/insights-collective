-- Ensure content_blocks has lesson_id column
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE;

-- Update content_blocks to reference lessons instead of modules directly
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