// ABOUTME: Visual regression tests — screenshot key routes and diff against baselines.
// ABOUTME: First run seeds baselines under __screenshots__/; subsequent runs fail on visual diffs.

import { test, expect } from '@playwright/test';

/**
 * Routes to snapshot for visual regression.
 * `role` picks which storageState (project) can run the route.
 * - 'public'    → runs in visual-public project (no auth)
 * - 'member'    → runs in visual-member project
 * - 'admin'     → runs in visual-admin project
 * - 'instructor'→ runs in visual-instructor project
 *
 * `waitFor` optionally scopes readiness to a selector before the screenshot.
 * `fullPage` defaults to true.
 */
type RouteSpec = {
  name: string;
  path: string;
  role: 'public' | 'member' | 'admin' | 'instructor';
  waitFor?: string;
  fullPage?: boolean;
};

const ROUTES: RouteSpec[] = [
  // Public
  { name: 'landing',        path: '/',              role: 'public' },
  { name: 'login',          path: '/login',         role: 'public',   waitFor: 'form' },
  { name: 'blog-index',     path: '/blog',          role: 'public' },
  { name: 'courses-catalog',path: '/courses',       role: 'public' },

  // Member
  { name: 'dashboard',            path: '/dashboard',                    role: 'member' },
  { name: 'enrolled-courses',     path: '/enrolled-courses',             role: 'member' },
  { name: 'notifications',        path: '/notifications',                role: 'member' },
  { name: 'profile',              path: '/profile',                      role: 'member' },
  { name: 'calendar',             path: '/calendar',                     role: 'member' },
  { name: 'resume-analyzer',      path: '/resume-analyzer',              role: 'member' },
  { name: 'career-pathway',       path: '/career-pathway',               role: 'member' },

  // Admin
  { name: 'admin-dashboard',      path: '/admin',                        role: 'admin' },
  { name: 'admin-users',          path: '/admin/users',                  role: 'admin' },
  { name: 'admin-courses',        path: '/admin/courses',                role: 'admin' },
  { name: 'admin-activity',       path: '/admin/activity',               role: 'admin' },
  { name: 'admin-page-visibility',path: '/admin/page-visibility',        role: 'admin' },
];

const ROLE_ENV = (process.env.VISUAL_ROLE || 'public') as RouteSpec['role'];

test.describe(`visual regression [${ROLE_ENV}]`, () => {
  // Match project → role so each project only executes its own routes.
  const routes = ROUTES.filter(r => r.role === ROLE_ENV);

  for (const route of routes) {
    test(`${route.name} @ ${route.path}`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' });

      if (route.waitFor) {
        await page.waitForSelector(route.waitFor, { timeout: 10_000 });
      }

      // Stabilize: disable animations/transitions/caret blink and hide anything
      // known to be non-deterministic (timestamps, avatars from external CDNs).
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }
          [data-visual-ignore],
          [data-testid="relative-time"],
          time {
            visibility: hidden !important;
          }
        `,
      });

      // Let fonts settle to avoid FOUT diffs.
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: route.fullPage ?? true,
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.01, // tolerate <1% pixel drift
      });
    });
  }
});
