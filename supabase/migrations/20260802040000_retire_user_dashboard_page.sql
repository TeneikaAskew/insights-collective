-- ABOUTME: Removes the page_visibility row for /user-dashboard, whose page and
-- ABOUTME: route are deleted in the same change.
--
-- WHY A MIGRATION AND NOT JUST THE LIVE DELETE
--
-- The row was already deleted from the live database by hand, and that is not
-- enough. 20260728000000_prune_page_visibility_dead_paths.sql does two things
-- to this path: it WHITELISTS it from the prune (so the delete there skips it)
-- and it SEEDS it back in the INSERT at the bottom. Any database replayed from
-- migrations — a fresh environment, a restored backup, a local `supabase db
-- reset` — therefore ends up with a visibility row for a page that no longer
-- exists, and the admin's Page Visibility screen offers a toggle that controls
-- nothing.
--
-- Editing that earlier migration would be the wrong fix: it is already applied
-- everywhere, and rewriting applied migrations makes the recorded history stop
-- matching what actually ran. A forward migration is the honest correction.
--
-- Idempotent, so it is safe on a database where the row is already gone (which
-- is the case in production right now).

DELETE FROM public.page_visibility
WHERE page_path = '/user-dashboard';

-- Leaves a note for the next person reading the prune migration, which still
-- names this path in both its whitelist and its seed list. Those lists are a
-- snapshot of what existed on 2026-07-28 and are not edited retroactively; this
-- migration is what makes the current state correct.
COMMENT ON TABLE public.page_visibility IS
  'Admin-controlled per-page visibility. /user-dashboard was retired on '
  '2026-08-02 (see 20260802040000); it is still named in the 20260728000000 '
  'prune migration''s whitelist and seed, which are historical and not edited.';
