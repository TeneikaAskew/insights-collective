-- ABOUTME: Removes the page_visibility row for /calendar, retired from the page
-- ABOUTME: manifest, mirroring 20260802040000 for /user-dashboard.
--
-- WHY THIS EXISTS NOW
--
-- 20260728000500_prune_page_visibility_dead_paths.sql both whitelists /calendar
-- from its prune and SEEDS it back in the INSERT at the bottom. That file has
-- never run anywhere — it shared version 20260728000000 with
-- hide_quiz_answer_key and was skipped in silence — so the seed has never taken
-- effect, and production has no /calendar row.
--
-- Renumbering it to 20260728000500 changes that. It becomes a migration that
-- reliably runs on any database replayed from migrations: a fresh environment, a
-- restored backup, a local `supabase db reset`. Those environments would seed a
-- visibility row for a route that no longer exists in src/config/pageManifest.ts,
-- and the admin's Page Visibility screen would offer a toggle controlling
-- nothing — until someone noticed and ran the in-app Sync by hand.
--
-- 20260802040000_retire_user_dashboard_page.sql already fixed exactly this for
-- /user-dashboard, and states the reasoning this migration follows: editing the
-- earlier migration would be the wrong fix, because rewriting applied history
-- makes the record stop matching what ran. A forward migration is the honest
-- correction. /calendar simply never got its counterpart.
--
-- Idempotent, so it is safe on production, where the row is already absent.

DELETE FROM public.page_visibility
WHERE page_path = '/calendar';

-- Supersedes the note 20260802040000 left, so the table comment names both
-- retired paths rather than only the first.
COMMENT ON TABLE public.page_visibility IS
  'Admin-controlled per-page visibility. /user-dashboard was retired on '
  '2026-08-02 (see 20260802040000) and /calendar on 2026-08-11 (see '
  '20260811020000). Both are still named in the 20260728000500 prune '
  'migration''s whitelist and seed, which are historical and not edited.';
