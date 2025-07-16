-- Add content_item_id column to assignments table (without foreign key constraint for now)
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS content_item_id UUID;