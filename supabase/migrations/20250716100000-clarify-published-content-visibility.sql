-- Clarify published content visibility rules
-- This migration adds comments to clarify that unpublished content should only be visible in editing interfaces

-- Add comment to content_items table
COMMENT ON COLUMN content_items.published IS 
'Published status of content. NULL/undefined = hidden from everyone, false = only visible to instructors in edit mode, true = visible to all enrolled users';

-- Update RLS policy for content_items to ensure unpublished content is only accessible in appropriate contexts
-- The existing policy should already handle this correctly, but we'll add a comment for clarity
COMMENT ON POLICY "Users can view published content items in enrolled courses" ON content_items IS 
'Students can only see published content. Instructors see all content when accessing via editing endpoints, but only published content in viewing contexts.';

-- Add comment to modules table for consistency
COMMENT ON COLUMN modules.published IS 
'Published status of module. NULL/undefined = hidden from everyone, false = only visible to instructors in edit mode, true = visible to all enrolled users';