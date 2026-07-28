-- Reconcile page_visibility with the page manifest
-- (src/config/pageManifest.ts) now that visibility is actually enforced.
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
