/**
 * Single source of truth for the page catalog used by the visibility system.
 *
 * Consumed by:
 *  - VisibilityGate / PageVisibilityContext — which paths govern a URL
 *  - PageVisibilityContext.syncAvailablePages — which rows belong in the
 *    `page_visibility` table (anything else is stale and gets removed)
 *  - AppSidebar — nav-link filtering
 *  - The admin Page Visibility manager — top-level grouping with children
 *
 * A "section" is a top-level path. Hiding a section hides its entire
 * subtree: /courses governs /courses/abc/builder, /blog governs /blog/my-post.
 * Children are sub-paths an admin can toggle independently of their parent;
 * a child is only reachable when every path in its governing chain is
 * visible (AND semantics).
 *
 * `aliases` are alternate URL prefixes that resolve to the same canonical
 * entry (legacy duplicates like /course-list, or detail-page prefixes like
 * /assistant/:id for the /assistants section). Aliases are never synced to
 * the database — only canonical paths get rows.
 */

export interface ManifestPage {
  /** Canonical path — also the `page_path` key in the page_visibility table */
  path: string;
  /** Human-readable name shown in the admin manager */
  name: string;
  /** Alternate URL prefixes governed by this entry */
  aliases?: string[];
  /** Independently toggleable sub-pages */
  children?: ManifestPage[];
}

export const PAGE_MANIFEST: ManifestPage[] = [
  { path: '/', name: 'Home' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/notifications', name: 'Notifications' },
  { path: '/profile', name: 'Profile' },
  {
    path: '/courses',
    name: 'Courses',
    aliases: ['/course-list', '/course'],
  },
  { path: '/course-management', name: 'Course Management' },
  { path: '/enrolled-courses', name: 'Enrolled Courses' },
  {
    path: '/interview-prep',
    name: 'Interview Prep',
    children: [
      { path: '/interview-prep/code-practice', name: 'Code Practice' },
      { path: '/interview-prep/job-description', name: 'Job Description Analyzer' },
      { path: '/interview-prep/mock-interview-room', name: 'Mock Interview Room' },
      { path: '/interview-prep/mock-interviews', name: 'Mock Interviews' },
      { path: '/interview-prep/star-practice', name: 'STAR Practice' },
    ],
  },
  { path: '/career-pathway', name: 'Career Pathway' },
  {
    path: '/assistants',
    name: 'AI Assistants',
    aliases: ['/assistant', '/assistant-interface'],
  },
  { path: '/explore-data-careers', name: 'Explore Data Careers' },
  { path: '/resume', name: 'Resume Analyzer' },
  { path: '/events', name: 'Events' },
  { path: '/messages', name: 'Messages' },
  { path: '/portfolio-explorer', name: 'Portfolio Explorer' },
  { path: '/portfolio-editor', name: 'Portfolio Editor' },
  { path: '/blog', name: 'Blog' },
  {
    path: '/resources',
    name: 'Resources',
    children: [{ path: '/resources/salary-guide', name: 'Data & AI Salary Guide' }],
  },
  { path: '/teneika-linkedin', name: 'Teneika LinkedIn' },
  { path: '/teneika-tweets', name: 'Teneika Tweets' },
  {
    path: '/survey',
    name: 'Surveys',
    aliases: ['/survey-confirmation'],
  },
];

/**
 * Paths never gated by page visibility:
 *  - auth flows must always work
 *  - legal pages must always be reachable
 *  - /portfolio/:customUrl and /verify-certificate/:code are public surfaces
 *  - /admin/* is role-gated by ProtectedRoute instead
 *  - /dev/* exists only in dev builds
 */
export const UNGATED_PATHS: string[] = [
  '/login',
  '/register',
  '/reset-password',
  '/auth-callback',
  '/auth',
  '/privacy-policy',
  '/terms-of-service',
  '/portfolio',
  '/verify-certificate',
  '/admin',
  '/dev',
];

/** True when `prefix` matches `pathname` on a segment boundary. */
function isSegmentPrefix(prefix: string, pathname: string): boolean {
  if (prefix === '/') {
    // Root only governs the landing page itself, never the whole site
    return pathname === '/';
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function normalize(pathname: string): string {
  // React Router matches routes case-insensitively, so the visibility matcher
  // must too — otherwise '/Resume' bypasses the gate on '/resume'. Manifest
  // paths are already lowercase.
  const lower = pathname.toLowerCase();
  if (lower.length > 1 && lower.endsWith('/')) {
    return lower.slice(0, -1);
  }
  return lower;
}

/** True when the pathname is exempt from visibility gating. */
export function isUngatedPath(pathname: string): boolean {
  const path = normalize(pathname);
  return UNGATED_PATHS.some(prefix => isSegmentPrefix(prefix, path));
}

/**
 * The chain of canonical manifest paths that govern a pathname, outermost
 * first. Every path in the chain must be visible for the page to show.
 *
 *   resolveGoverningPaths('/interview-prep/star-practice')
 *     → ['/interview-prep', '/interview-prep/star-practice']
 *   resolveGoverningPaths('/courses/abc/learn')   → ['/courses']
 *   resolveGoverningPaths('/assistant/xyz')       → ['/assistants']
 *   resolveGoverningPaths('/course')              → ['/courses']  (alias)
 *   resolveGoverningPaths('/some-unknown-page')   → []
 */
export function resolveGoverningPaths(pathname: string): string[] {
  const path = normalize(pathname);

  const section = PAGE_MANIFEST.find(
    entry =>
      isSegmentPrefix(entry.path, path) ||
      entry.aliases?.some(alias => isSegmentPrefix(alias, path)),
  );
  if (!section) {
    return [];
  }

  const chain = [section.path];
  for (const child of section.children ?? []) {
    if (
      isSegmentPrefix(child.path, path) ||
      child.aliases?.some(alias => isSegmentPrefix(alias, path))
    ) {
      chain.push(child.path);
    }
  }
  return chain;
}

/**
 * Every canonical entry (sections + children) as flat rows for the
 * page_visibility table sync. Aliases are intentionally excluded.
 */
export function getAllManifestEntries(): Array<{ page_path: string; page_name: string }> {
  const rows: Array<{ page_path: string; page_name: string }> = [];
  for (const section of PAGE_MANIFEST) {
    rows.push({ page_path: section.path, page_name: section.name });
    for (const child of section.children ?? []) {
      rows.push({ page_path: child.path, page_name: child.name });
    }
  }
  return rows;
}
