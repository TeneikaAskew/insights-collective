-- Remove page_visibility rows for paths the visibility system no longer
-- manages. These rows are worse than cosmetic: a row for a path the gate
-- never matches is an admin toggle that silently does nothing.
--
-- Categories removed:
--   * auth/legal surfaces — never gated (must always be reachable)
--   * /admin/* — role-gated by ProtectedRoute, not page visibility
--   * dead routes — /forum(s) redirect to /dashboard; /mock-interviews and
--     /code-practice redirect into /interview-prep
--   * legacy aliases — /course-list is an alias of /courses now
--
-- The client-side sync (PageVisibilityContext.syncAvailablePages) performs
-- the same reconciliation against src/config/pageManifest.ts; this migration
-- clears the known-dead rows for environments where no admin runs a sync.

DELETE FROM public.page_visibility
WHERE page_path IN (
  '/login',
  '/register',
  '/reset-password',
  '/auth-callback',
  '/privacy-policy',
  '/terms-of-service',
  '/forum',
  '/forums',
  '/mock-interviews',
  '/code-practice',
  '/course-list',
  '/admin',
  '/admin/activity',
  '/admin/courses',
  '/admin/events',
  '/admin/users',
  '/admin/page-visibility',
  '/admin/unified-form-management',
  '/admin/local-storage-debug'
);
