-- Apply difficulty_level and estimated_hours migration directly
-- This can be run in Supabase SQL Editor
-- Updated to work with content_items table (no content_blocks)

-- Step 1: Create ENUM type for difficulty levels
DO $$ BEGIN
  CREATE TYPE course_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add new columns to courses table
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
  v_content_item_count INTEGER;
  v_total_complexity INTEGER;
BEGIN
  -- Count modules
  SELECT COUNT(*) INTO v_module_count
  FROM modules
  WHERE course_id = course_id_param;

  -- Count assignments (via content_items)
  SELECT COUNT(*) INTO v_assignment_count
  FROM assignments a
  JOIN content_items ci ON a.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  -- Count quizzes (via content_items)
  SELECT COUNT(DISTINCT q.id) INTO v_quiz_count
  FROM quizzes q
  JOIN content_items ci ON q.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  -- Count all content items (pages, assignments, quizzes, etc.)
  SELECT COUNT(*) INTO v_content_item_count
  FROM content_items
  WHERE course_id = course_id_param;

  -- Calculate complexity score
  v_total_complexity :=
    (v_module_count * 5) +
    (v_assignment_count * 10) +
    (v_quiz_count * 8) +
    (v_content_item_count * 2);

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
  v_content_item_count INTEGER := 0;
BEGIN
  -- Sum duration or estimated_duration from lessons (prefer duration, fallback to estimated_duration)
  SELECT COALESCE(SUM(
    CASE
      WHEN duration IS NOT NULL THEN duration
      WHEN estimated_duration IS NOT NULL THEN estimated_duration
      ELSE 30  -- Default 30 minutes per lesson if no duration set
    END
  ), 0) INTO v_lesson_minutes
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = course_id_param;

  v_total_minutes := v_total_minutes + v_lesson_minutes;

  -- Count assignments (estimate 60 minutes each)
  SELECT COUNT(*) INTO v_assignment_count
  FROM assignments a
  JOIN content_items ci ON a.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  v_total_minutes := v_total_minutes + (v_assignment_count * 60);

  -- Count quizzes (estimate 30 minutes each)
  SELECT COUNT(DISTINCT q.id) INTO v_quiz_count
  FROM quizzes q
  JOIN content_items ci ON q.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  v_total_minutes := v_total_minutes + (v_quiz_count * 30);

  -- Count content items (estimate 15 minutes each for pages/materials)
  SELECT COUNT(*) INTO v_content_item_count
  FROM content_items
  WHERE course_id = course_id_param
    AND type IN ('page', 'external_url', 'external_tool');

  v_total_minutes := v_total_minutes + (v_content_item_count * 15);

  -- If no content exists, return minimum of 1 hour
  IF v_total_minutes = 0 THEN
    RETURN 1.0;
  END IF;

  -- Convert minutes to hours and round to 2 decimal places
  RETURN ROUND(v_total_minutes / 60.0, 2);
END;
$$;

COMMENT ON FUNCTION calculate_course_hours IS 'Estimates total course hours based on lesson durations, assignments, quizzes, and content items';

-- Step 6: Migrate existing courses data
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
LEFT JOIN content_items ci ON c.id = ci.course_id AND ci.type = 'assignment'
LEFT JOIN assignments a ON ci.id = a.content_item_id
LEFT JOIN lessons l ON m.id = l.module_id
GROUP BY c.id, c.title, c.difficulty_level, c.estimated_hours,
         c.published, c.status, c.enrollment_status;

COMMENT ON VIEW course_statistics IS 'Aggregated statistics for courses including difficulty and time estimates';

-- Step 10: Add validation constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_estimated_hours_positive'
    AND conrelid = 'courses'::regclass
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT check_estimated_hours_positive
      CHECK (estimated_hours > 0);
  END IF;
END $$;

-- Step 11: Create helper function for filtering courses by difficulty
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

-- Step 12: Verification query
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
