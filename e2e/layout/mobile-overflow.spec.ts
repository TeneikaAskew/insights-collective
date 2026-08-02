// ABOUTME: Fails when a signed-in page scrolls sideways on a phone, one test per route.
// ABOUTME: Runs under chromium-member because sixteen routes are only measurable with a session.
import { test, expect } from '@playwright/test';
import {
  MOBILE_VIEWPORT,
  expectNoMobileOverflow,
  manifestPaths,
} from '../helpers/mobile-overflow';

/**
 * Signed in, deliberately. A signed-out sweep bounces off the gated routes to
 * /login and then reports a clean login page as though it were evidence about
 * the page that was asked for. The signed-out surfaces live in the sibling spec
 * under e2e/auth/, which chromium-public claims.
 */

/**
 * `/` is not here: Index redirects an authenticated visitor to /dashboard (or
 * their last path), so a member session can never render it. It is measured
 * signed out instead.
 */
const SIGNED_IN_ONLY = ['/'];

/**
 * Manifest entries with no parameterless form to render.
 *
 * Both entries exist to govern a parameterised subtree in the visibility
 * system — resolveGoverningPaths('/portfolio-editor/p1') needs the row — not
 * because a user can land on the bare path.
 *
 *   /interview-prep/mock-interview-room  redirects to .../mock-interviews;
 *     MockInterviewRoom.tsx guards on a missing :sessionId, because a room
 *     with no session has nothing to show.
 *   /portfolio-editor  App.tsx only routes /portfolio-editor/:pageId; the bare
 *     path redirects to /portfolio-explorer, which is measured under its own
 *     manifest entry. (It used to render the 404 page and pass this spec for
 *     that reason, which is why the redirect exists.)
 *
 * Named here rather than quietly dropped, so the gap stays visible: neither
 * page's own mobile layout is measured, and covering them needs a seeded
 * session id and portfolio page id respectively.
 */
const NO_PARAMETERLESS_FORM = ['/interview-prep/mock-interview-room', '/portfolio-editor'];

/**
 * Manifest entries whose path is now only a redirect, mapped to the surface that
 * actually renders.
 *
 * `/messages` still governs visibility — admins switch Messages on and off by that
 * key — but messages themselves moved into the Dashboard, next to the Calendar, so
 * the path redirects to `/dashboard?tab=messages`. Measuring the redirect target
 * keeps the Messages UI in this sweep. Simply excluding the entry would have taken
 * a real surface out of the mobile check and left the suite green about it, which
 * is the failure mode the accounting test at the bottom exists to prevent.
 */
const MEASURE_INSTEAD: Record<string, string> = {
  '/messages': '/dashboard?tab=messages',
};

const ROUTES: string[] = [
  ...manifestPaths()
    .filter((path) => !SIGNED_IN_ONLY.includes(path) && !NO_PARAMETERLESS_FORM.includes(path))
    .map((path) => MEASURE_INSTEAD[path] ?? path),
  '/privacy-policy',
  '/terms-of-service',
];

test.use({ viewport: MOBILE_VIEWPORT });

for (const route of ROUTES) {
  test(`${route} does not scroll sideways at ${MOBILE_VIEWPORT.width}px`, async ({ page }, testInfo) => {
    await expectNoMobileOverflow(page, testInfo, route);
  });
}

test('every manifest page is accounted for', () => {
  // A page added to the manifest without a row here would go unmeasured, and
  // nobody would notice because the suite would still be green. The two
  // exclusion lists count as accounted for — each carries a written reason —
  // but a path in none of the three fails.
  const covered = new Set([
    ...ROUTES,
    ...SIGNED_IN_ONLY,
    ...NO_PARAMETERLESS_FORM,
    // Measured under its redirect target rather than its own path.
    ...Object.keys(MEASURE_INSTEAD),
  ]);
  for (const path of manifestPaths()) {
    expect(covered, `${path} is in the manifest but has no mobile-overflow test`).toContain(path);
  }
});
