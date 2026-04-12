-- Add columns to assignments table that are defined in EnhancedAssignment type
-- but were missing from the DB, causing all create/update operations to fail.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS submission_types TEXT[] DEFAULT ARRAY['file_upload'],
  ADD COLUMN IF NOT EXISTS allowed_file_extensions TEXT[],
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS grading_type TEXT DEFAULT 'points',
  ADD COLUMN IF NOT EXISTS peer_review_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS peer_review_due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymous_grading BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_policy JSONB;
