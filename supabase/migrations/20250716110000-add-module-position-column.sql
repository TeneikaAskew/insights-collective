-- Add position column to modules table for drag and drop ordering
ALTER TABLE modules 
ADD COLUMN IF NOT EXISTS position INTEGER;

-- Update existing modules to have position based on their week number
UPDATE modules 
SET position = week - 1
WHERE position IS NULL;

-- Add index for better performance when ordering by position
CREATE INDEX IF NOT EXISTS idx_modules_course_position 
ON modules(course_id, position);

-- Comment to explain the column purpose
COMMENT ON COLUMN modules.position IS 'Zero-based position for drag-and-drop ordering of modules within a course';