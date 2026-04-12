-- Track rubric_criteria schema changes already applied to remote DB:
-- renamed `criterion` column to `title`, added `levels` JSONB column.
-- These are guarded so the migration is safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rubric_criteria'
      AND column_name = 'criterion'
  ) THEN
    ALTER TABLE public.rubric_criteria RENAME COLUMN criterion TO title;
  END IF;
END $$;

ALTER TABLE public.rubric_criteria
  ADD COLUMN IF NOT EXISTS levels JSONB NOT NULL DEFAULT '[]';
