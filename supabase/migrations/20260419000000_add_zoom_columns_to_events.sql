-- Add Zoom-specific columns to events table for meeting ID tracking,
-- host start URL, and recurrence configuration.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS zoom_meeting_id BIGINT,
  ADD COLUMN IF NOT EXISTS zoom_start_url  TEXT,
  ADD COLUMN IF NOT EXISTS zoom_recurrence JSONB;
