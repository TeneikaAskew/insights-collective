-- Mock interview scheduling has never worked against this database.
--
-- src/pages/interview-prep/MockInterviews.tsx inserts end_time and
-- video_platform when a session is booked, but neither column exists on
-- mock_sessions. Postgres rejects the insert with 42703 before anything is
-- written, the page throws, and the user gets "Failed to schedule". Both
-- references date to the commit that created the page, so no scheduled
-- session has ever been saved.
--
-- The follow-up meeting-link work (20260727000200) added meeting_url,
-- start_url and meeting_id on the assumption video_platform already
-- existed — its own comment says so — which is why the gap went unnoticed.
--
-- end_time       — session end, already computed by the booking form
-- video_platform — provider label shown on the session card ('Zoom',
--                  'Google Meet', 'Jitsi'), and read by MockInterviewRoom

ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS end_time timestamptz;
ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS video_platform text;

COMMENT ON COLUMN mock_sessions.end_time IS
  'When the session ends. Set from the booking form alongside session_time.';
COMMENT ON COLUMN mock_sessions.video_platform IS
  'Provider label for the meeting link in meeting_url — Zoom when the Zoom integration created it, otherwise Jitsi. Displayed on the session card.';
