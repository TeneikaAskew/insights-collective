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

const ROUTES: string[] = [
  ...manifestPaths().filter((path) => !SIGNED_IN_ONLY.includes(path)),
  '/privacy-policy',
  '/terms-of-service',
];

test.use({ viewport: MOBILE_VIEWPORT });

for (const route of ROUTES) {
  test(`${route} does not scroll sideways at ${MOBILE_VIEWPORT.width}px`, async ({ page }, testInfo) => {
    await expectNoMobileOverflow(page, testInfo, route);
  });
}

test('every manifest page is measured somewhere', () => {
  // A page added to the manifest without a row here would go unmeasured, and
  // nobody would notice because the suite would still be green.
  const covered = new Set([...ROUTES, ...SIGNED_IN_ONLY]);
  for (const path of manifestPaths()) {
    expect(covered, `${path} is in the manifest but has no mobile-overflow test`).toContain(path);
  }
});
