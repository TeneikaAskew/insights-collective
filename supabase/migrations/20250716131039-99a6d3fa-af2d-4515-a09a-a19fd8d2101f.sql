-- Add position field to modules table for proper ordering
ALTER TABLE modules ADD COLUMN position INTEGER;

-- Update existing modules to have position based on created_at order
WITH numbered_modules AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY created_at) as row_num
  FROM modules
)
UPDATE modules 
SET position = numbered_modules.row_num 
FROM numbered_modules 
WHERE modules.id = numbered_modules.id;

-- Make position NOT NULL after setting values
ALTER TABLE modules ALTER COLUMN position SET NOT NULL;

-- Add index for better performance
CREATE INDEX idx_modules_course_position ON modules(course_id, position);