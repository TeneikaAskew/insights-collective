-- Migration: Add course_id to assignments table for easier querying
-- This fixes the issue where assignments couldn't be queried directly by course
-- without joining through content_items

-- Step 1: Add course_id column to assignments table
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

-- Step 2: Populate course_id from content_items for existing assignments
UPDATE assignments
SET course_id = (
  SELECT course_id
  FROM content_items
  WHERE content_items.id = assignments.content_item_id
)
WHERE course_id IS NULL;

-- Step 3: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);

-- Step 4: Add module_id for backward compatibility with old code
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE SET NULL;

-- Step 5: Populate module_id from content_items
UPDATE assignments
SET module_id = (
  SELECT module_id
  FROM content_items
  WHERE content_items.id = assignments.content_item_id
)
WHERE module_id IS NULL;

-- Step 6: Add index for module queries
CREATE INDEX IF NOT EXISTS idx_assignments_module_id ON assignments(module_id);

-- Step 7: Make content_item_id more explicit with an index
CREATE INDEX IF NOT EXISTS idx_assignments_content_item_id ON assignments(content_item_id);

-- Step 8: Add comment for documentation
COMMENT ON COLUMN assignments.course_id IS 'Direct reference to course for easier querying without joins';
COMMENT ON COLUMN assignments.module_id IS 'Direct reference to module for backward compatibility';

-- Step 9: Verify the migration
DO $$
DECLARE
  v_assignments_without_course INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_assignments_without_course
  FROM assignments
  WHERE course_id IS NULL;

  IF v_assignments_without_course > 0 THEN
    RAISE WARNING 'Migration incomplete: % assignments still missing course_id', v_assignments_without_course;
  ELSE
    RAISE NOTICE 'Migration successful: All assignments have course_id populated';
  END IF;
END $$;
