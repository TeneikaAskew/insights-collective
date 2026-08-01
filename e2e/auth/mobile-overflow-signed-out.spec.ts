// ABOUTME: Mobile overflow for the surfaces only a signed-out visitor can reach.
// ABOUTME: Lives under e2e/auth/ because that is the path chromium-public claims.
import { test } from '@playwright/test';
import { MOBILE_VIEWPORT, expectNoMobileOverflow } from '../helpers/mobile-overflow';

/**
 * These four redirect an authenticated visitor away — Index to /dashboard, the
 * auth pages to wherever the sign-in came from — so the signed-in sweep in
 * e2e/layout/ cannot measure them. It excludes them by name and this spec picks
 * them up, so neither list has a silent hole.
 */
const ROUTES = ['/', '/login', '/register', '/reset-password'];

test.use({ viewport: MOBILE_VIEWPORT });

for (const route of ROUTES) {
  test(`${route} does not scroll sideways at ${MOBILE_VIEWPORT.width}px, signed out`, async ({ page }, testInfo) => {
    await expectNoMobileOverflow(page, testInfo, route);
  });
}
