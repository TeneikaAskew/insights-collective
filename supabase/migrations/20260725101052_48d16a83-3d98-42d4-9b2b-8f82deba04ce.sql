-- Fix course creation: modules.description and modules.week were NOT NULL with no defaults,
-- causing every module insert from the builder to fail. Give them sane defaults so the
-- client can insert modules without knowing about these legacy columns.
ALTER TABLE public.modules ALTER COLUMN description SET DEFAULT '';
ALTER TABLE public.modules ALTER COLUMN week SET DEFAULT 1;

-- Backfill any nulls (should be none, but safe).
UPDATE public.modules SET description = '' WHERE description IS NULL;
UPDATE public.modules SET week = 1 WHERE week IS NULL;