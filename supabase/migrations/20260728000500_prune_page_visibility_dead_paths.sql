-- Reconcile page_visibility with the page manifest
-- (src/config/pageManifest.ts) now that visibility is actually enforced.
--
-- RENUMBERED from 20260728000000 to 20260728000500 on 2026-08-11. It shared
-- that version with 20260728000000_hide_quiz_answer_key.sql, and Supabase
-- tracks applied migrations by version, not by filename: the version was
-- recorded once, for hide_quiz_answer_key, and THIS FILE WAS SILENTLY SKIPPED.
-- It has never run against production. `schema_migrations` names the recorded
-- row `hide_quiz_answer_key`, which is how the skip was finally identified.
--
-- It is being RECORDED rather than executed, via
-- scripts/reconcile/20260728000500_prune_page_visibility_dead_paths.sql. The
-- reason is the seed at the foot of this file: two of the paths it inserts,
-- /user-dashboard and /calendar, have since been retired from the manifest, so
-- running it now would re-create exactly the dead rows the DELETE above exists
-- to remove. The in-app Sync has meanwhile performed the same reconciliation
-- this file describes, which is why the live table already matches the manifest.
--
-- The file is kept, unchanged below this header, so a database built from
-- migrations alone still reaches the state it describes.
--
-- Until this release, hiding a page did nothing on ~all routes (the guard
-- wrapped only 4 of them, and it rendered the page behind a blur anyway),
-- so the table accumulated years of drift: rows for dead routes, /admin
-- surfaces that are role-gated instead, malformed paths like
-- '/courses/@/components/LocalStorageDebug', and hidden flags that never
-- had any effect. With enforcement live, every one of those rows becomes
-- load-bearing, so this migration:
--
--   1. deletes every row whose path is not a canonical manifest path
--      (the in-app "Sync" performs the same reconciliation), and
--   2. resets the hidden flags on '/' and '/blog' — flags that predate
--      enforcement and never worked, and which would otherwise take the
--      landing page and blog dark on deploy. '/teneika-linkedin' keeps its
--      hidden flag: it was one of the 4 genuinely guarded routes, so its
--      flag reflects working intent.

DELETE FROM public.page_visibility
WHERE page_path NOT IN (
  '/',
  '/dashboard',
  '/user-dashboard',
  '/notifications',
  '/calendar',
  '/profile',
  '/courses',
  '/course-management',
  '/enrolled-courses',
  '/interview-prep',
  '/interview-prep/code-practice',
  '/interview-prep/job-description',
  '/interview-prep/mock-interview-room',
  '/interview-prep/mock-interviews',
  '/interview-prep/star-practice',
  '/career-pathway',
  '/assistants',
  '/explore-data-careers',
  '/resume',
  '/events',
  '/messages',
  '/portfolio-explorer',
  '/portfolio-editor',
  '/blog',
  '/resources',
  '/teneika-linkedin',
  '/teneika-tweets',
  '/survey'
);

UPDATE public.page_visibility
SET visible_to_users = true,
    visible_to_instructors = true
WHERE page_path IN ('/', '/blog');

-- Seed every canonical manifest row that does not exist yet. Without this,
-- a database initialized purely from migrations would be missing rows for
-- newer pages: the gate defaults a missing row to visible (no security
-- hole), but the admin manager disables a page's switches until its row
-- exists — leaving those pages untoggleable until someone runs Sync.
INSERT INTO public.page_visibility (page_path, page_name)
VALUES
  ('/', 'Home'),
  ('/dashboard', 'Dashboard'),
  ('/user-dashboard', 'User Dashboard'),
  ('/notifications', 'Notifications'),
  ('/calendar', 'Calendar'),
  ('/profile', 'Profile'),
  ('/courses', 'Courses'),
  ('/course-management', 'Course Management'),
  ('/enrolled-courses', 'Enrolled Courses'),
  ('/interview-prep', 'Interview Prep'),
  ('/interview-prep/code-practice', 'Code Practice'),
  ('/interview-prep/job-description', 'Job Description Analyzer'),
  ('/interview-prep/mock-interview-room', 'Mock Interview Room'),
  ('/interview-prep/mock-interviews', 'Mock Interviews'),
  ('/interview-prep/star-practice', 'STAR Practice'),
  ('/career-pathway', 'Career Pathway'),
  ('/assistants', 'AI Assistants'),
  ('/explore-data-careers', 'Explore Data Careers'),
  ('/resume', 'Resume Analyzer'),
  ('/events', 'Events'),
  ('/messages', 'Messages'),
  ('/portfolio-explorer', 'Portfolio Explorer'),
  ('/portfolio-editor', 'Portfolio Editor'),
  ('/blog', 'Blog'),
  ('/resources', 'Resources'),
  ('/teneika-linkedin', 'Teneika LinkedIn'),
  ('/teneika-tweets', 'Teneika Tweets'),
  ('/survey', 'Surveys')
ON CONFLICT (page_path) DO NOTHING;
