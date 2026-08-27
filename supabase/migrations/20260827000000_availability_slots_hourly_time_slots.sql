-- Mock-interview availability could never be saved: the UI writes hourly slot
-- ids (slot_8_9 … slot_20_21 — TIME_SLOTS in
-- src/pages/interview-prep/MockInterviews.tsx), but
-- availability_slots_time_block_check still enforced the original
-- morning/afternoon/evening design. Every "Save Availability" failed with
-- 23514, so find_available_peers never had a row to match, "No users available"
-- was the only state the booking flow could reach, and both availability_slots
-- and mock_sessions sat empty in production.
--
-- The table is empty (verified live before this migration), so swapping the
-- constraint validates nothing and rewrites nothing.
--
-- The check accepts any `slot_<start>_<end>` with 0–23 hour parts rather than
-- enumerating today's thirteen ids: the id list lives in the UI and has already
-- changed shape once without the constraint following, which is precisely how
-- this bug happened. The shape is the invariant the database can own; the
-- catalog of offered slots is the UI's.

alter table public.availability_slots
  drop constraint if exists availability_slots_time_block_check;

alter table public.availability_slots
  add constraint availability_slots_time_slot_check
  check (time_slot ~ '^slot_([0-9]|1[0-9]|2[0-3])_([0-9]|1[0-9]|2[0-3])$');
