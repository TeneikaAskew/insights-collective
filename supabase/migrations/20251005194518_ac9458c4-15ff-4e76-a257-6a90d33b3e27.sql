-- Remove legacy content_blocks system
-- This migration removes the old content_blocks and content_progress tables
-- as they have been replaced by the new content_items system

-- Drop dependent table first (CASCADE will handle triggers)
DROP TABLE IF EXISTS public.content_progress CASCADE;

-- Drop the main content_blocks table (CASCADE will handle all dependencies)
DROP TABLE IF EXISTS public.content_blocks CASCADE;