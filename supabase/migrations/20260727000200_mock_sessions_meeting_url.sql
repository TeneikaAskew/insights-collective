-- Mock interviews, Option A (docs/architecture/mock-interview-video.md):
-- give every scheduled session a real, joinable meeting link. Until now
-- video_platform stored the string 'Google Meet' but no meeting was ever
-- created, so matched peers had no way to actually meet.
--
-- meeting_url  — the link both participants open (Zoom join_url, or a
--                Jitsi room when Zoom is unavailable)
-- start_url    — Zoom's host link, when Zoom created the meeting
-- meeting_id   — provider-side id, for later lookup/cancellation

ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS meeting_url text;
ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS start_url text;
ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS meeting_id text;

COMMENT ON COLUMN mock_sessions.meeting_url IS
  'Joinable video link for the session. Zoom join_url when the Zoom integration is configured, otherwise a Jitsi room derived from the session id. Both work in a browser with no account.';
