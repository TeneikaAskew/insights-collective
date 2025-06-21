-- Create default lessons for modules with orphaned content blocks
INSERT INTO lessons (module_id, title, description, order_num, content, completion_required, completion_criteria)
SELECT DISTINCT 
  cb.module_id,
  'Lesson 1: ' || m.title,
  'Default lesson created from existing content',
  1,
  'This lesson contains the existing content from this module.',
  true,
  '{"type": "all_blocks"}'::jsonb
FROM content_blocks cb
JOIN modules m ON cb.module_id = m.id
WHERE cb.lesson_id IS NULL;

-- Update content blocks to reference the new lessons
UPDATE content_blocks 
SET lesson_id = l.id
FROM lessons l
WHERE content_blocks.module_id = l.module_id 
  AND content_blocks.lesson_id IS NULL 
  AND l.order_num = 1;

-- Update lesson content_blocks_count
UPDATE lessons 
SET content_blocks_count = (
  SELECT COUNT(*) 
  FROM content_blocks cb 
  WHERE cb.lesson_id = lessons.id
)
WHERE id IN (
  SELECT DISTINCT lesson_id 
  FROM content_blocks 
  WHERE lesson_id IS NOT NULL
);