-- Migration: Add difficulty_level and estimated_hours to courses table
-- Phase 1 of COURSES_ROADMAP.md implementation
-- Date: 2025-10-05

-- Step 1: Create ENUM type for difficulty levels
DO $$ BEGIN
  CREATE TYPE course_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add new columns to courses table
-- These are nullable initially to allow data migration
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS difficulty_level course_difficulty,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,2);

-- Step 3: Add helpful comments
COMMENT ON COLUMN courses.difficulty_level IS 'Course difficulty level: beginner, intermediate, or advanced';
COMMENT ON COLUMN courses.estimated_hours IS 'Estimated hours to complete the course';

-- Step 4: Create function to estimate course difficulty based on content
CREATE OR REPLACE FUNCTION calculate_course_difficulty(course_id_param UUID)
RETURNS course_difficulty
LANGUAGE plpgsql
AS $$
DECLARE
  v_module_count INTEGER;
  v_assignment_count INTEGER;
  v_quiz_count INTEGER;
  v_content_block_count INTEGER;
  v_total_complexity INTEGER;
BEGIN
  -- Count modules
  SELECT COUNT(*) INTO v_module_count
  FROM modules
  WHERE course_id = course_id_param;

  -- Count assignments across all modules
  SELECT COUNT(*) INTO v_assignment_count
  FROM assignments
  WHERE course_id = course_id_param;

  -- Count quizzes across all modules
  SELECT COUNT(DISTINCT q.id) INTO v_quiz_count
  FROM quizzes q
  JOIN content_items ci ON q.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  -- Count content blocks
  SELECT COUNT(*) INTO v_content_block_count
  FROM content_blocks cb
  JOIN modules m ON cb.module_id = m.id
  WHERE m.course_id = course_id_param;

  -- Calculate complexity score
  v_total_complexity :=
    (v_module_count * 5) +
    (v_assignment_count * 10) +
    (v_quiz_count * 8) +
    (v_content_block_count * 2);

  -- Determine difficulty based on complexity
  IF v_total_complexity < 50 THEN
    RETURN 'beginner';
  ELSIF v_total_complexity < 150 THEN
    RETURN 'intermediate';
  ELSE
    RETURN 'advanced';
  END IF;
END;
$$;

COMMENT ON FUNCTION calculate_course_difficulty IS 'Calculates course difficulty based on module count, assignments, quizzes, and content complexity';

-- Step 5: Create function to estimate course hours
CREATE OR REPLACE FUNCTION calculate_course_hours(course_id_param UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_minutes NUMERIC := 0;
  v_lesson_minutes NUMERIC := 0;
  v_assignment_count INTEGER := 0;
  v_quiz_count INTEGER := 0;
  v_content_block_count INTEGER := 0;
BEGIN
  -- Sum estimated_duration from lessons (INTEGER minutes, duration is TEXT and mostly empty)
  SELECT COALESCE(SUM(
    COALESCE(estimated_duration, 30)
  ), 0) INTO v_lesson_minutes
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = course_id_param;

  v_total_minutes := v_total_minutes + v_lesson_minutes;

  -- Count assignments (estimate 60 minutes each)
  SELECT COUNT(*) INTO v_assignment_count
  FROM assignments
  WHERE course_id = course_id_param;

  v_total_minutes := v_total_minutes + (v_assignment_count * 60);

  -- Count quizzes (estimate 30 minutes each)
  SELECT COUNT(DISTINCT q.id) INTO v_quiz_count
  FROM quizzes q
  JOIN content_items ci ON q.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  v_total_minutes := v_total_minutes + (v_quiz_count * 30);

  -- Count content blocks (estimate 15 minutes each)
  SELECT COUNT(*) INTO v_content_block_count
  FROM content_blocks cb
  JOIN modules m ON cb.module_id = m.id
  WHERE m.course_id = course_id_param;

  v_total_minutes := v_total_minutes + (v_content_block_count * 15);

  -- If no content exists, return minimum of 1 hour
  IF v_total_minutes = 0 THEN
    RETURN 1.0;
  END IF;

  -- Convert minutes to hours and round to 2 decimal places
  RETURN ROUND(v_total_minutes / 60.0, 2);
END;
$$;

COMMENT ON FUNCTION calculate_course_hours IS 'Estimates total course hours based on lessons, assignments, quizzes, and content blocks';

-- Step 6: Migrate existing courses data
-- Update difficulty_level and estimated_hours for all existing courses
UPDATE courses
SET
  difficulty_level = COALESCE(
    difficulty_level,
    calculate_course_difficulty(id)
  ),
  estimated_hours = COALESCE(
    estimated_hours,
    calculate_course_hours(id)
  )
WHERE difficulty_level IS NULL OR estimated_hours IS NULL;

-- Step 7: Set default values for future courses
-- Beginner level and 1 hour minimum for new courses
ALTER TABLE courses
  ALTER COLUMN difficulty_level SET DEFAULT 'beginner',
  ALTER COLUMN estimated_hours SET DEFAULT 1.0;

-- Step 8: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_courses_difficulty_level ON courses(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_courses_estimated_hours ON courses(estimated_hours);

-- Step 9: Create a view for course statistics including the new fields
CREATE OR REPLACE VIEW course_statistics AS
SELECT
  c.id,
  c.title,
  c.difficulty_level,
  c.estimated_hours,
  c.published,
  c.status,
  c.enrollment_status,
  COUNT(DISTINCT m.id) as module_count,
  COUNT(DISTINCT e.id) as enrollment_count,
  COUNT(DISTINCT a.id) as assignment_count,
  COUNT(DISTINCT l.id) as lesson_count
FROM courses c
LEFT JOIN modules m ON c.id = m.course_id
LEFT JOIN enrollments e ON c.id = e.course_id
LEFT JOIN assignments a ON c.id = a.course_id
LEFT JOIN lessons l ON m.id = l.module_id
GROUP BY c.id, c.title, c.difficulty_level, c.estimated_hours,
         c.published, c.status, c.enrollment_status;

COMMENT ON VIEW course_statistics IS 'Aggregated statistics for courses including difficulty and time estimates';

-- Step 10: Create a function to update course estimates when content changes
CREATE OR REPLACE FUNCTION refresh_course_estimates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the course estimates when content is added/modified
  UPDATE courses
  SET
    difficulty_level = calculate_course_difficulty(NEW.course_id),
    estimated_hours = calculate_course_hours(NEW.course_id),
    updated_at = NOW()
  WHERE id = NEW.course_id;

  RETURN NEW;
END;
$$;

-- Step 11: Create triggers to auto-update estimates
-- Trigger for module changes
DROP TRIGGER IF EXISTS trigger_refresh_course_estimates_on_module ON modules;
CREATE TRIGGER trigger_refresh_course_estimates_on_module
  AFTER INSERT OR UPDATE OR DELETE ON modules
  FOR EACH ROW
  EXECUTE FUNCTION refresh_course_estimates();

-- Trigger for assignment changes
DROP TRIGGER IF EXISTS trigger_refresh_course_estimates_on_assignment ON assignments;
CREATE TRIGGER trigger_refresh_course_estimates_on_assignment
  AFTER INSERT OR UPDATE OR DELETE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION refresh_course_estimates();

-- Step 12: Add validation constraint
ALTER TABLE courses
  ADD CONSTRAINT check_estimated_hours_positive
  CHECK (estimated_hours > 0);

-- Step 13: Create helper function for filtering courses by difficulty
CREATE OR REPLACE FUNCTION get_courses_by_difficulty(diff_level course_difficulty)
RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  difficulty_level course_difficulty,
  estimated_hours NUMERIC,
  enrollment_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.description,
    c.difficulty_level,
    c.estimated_hours,
    COUNT(e.id)::BIGINT as enrollment_count
  FROM courses c
  LEFT JOIN enrollments e ON c.id = e.course_id
  WHERE c.difficulty_level = diff_level
    AND c.published = true
  GROUP BY c.id, c.title, c.description, c.difficulty_level, c.estimated_hours
  ORDER BY enrollment_count DESC, c.title;
END;
$$;

COMMENT ON FUNCTION get_courses_by_difficulty IS 'Retrieves published courses filtered by difficulty level';

-- Step 14: Migration verification query
-- This can be run to verify the migration worked correctly
DO $$
DECLARE
  v_updated_count INTEGER;
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM courses
  WHERE difficulty_level IS NOT NULL AND estimated_hours IS NOT NULL;

  SELECT COUNT(*) INTO v_null_count
  FROM courses
  WHERE difficulty_level IS NULL OR estimated_hours IS NULL;

  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  - Courses with difficulty & hours: %', v_updated_count;
  RAISE NOTICE '  - Courses missing data: %', v_null_count;

  IF v_null_count > 0 THEN
    RAISE WARNING 'Some courses still have NULL difficulty or hours. Manual review may be needed.';
  END IF;
END $$;
