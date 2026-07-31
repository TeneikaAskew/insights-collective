// ABOUTME: Visual regression tests — screenshot key routes and diff against baselines.
// ABOUTME: First run seeds baselines under __screenshots__/; subsequent runs fail on visual diffs.

import { test, expect } from '@playwright/test';

type RouteRole = 'public' | 'member' | 'admin' | 'instructor';

type RouteSpec = {
  name: string;
  path: string;
  role: RouteRole;
  waitFor?: string;
  fullPage?: boolean;
};

const ROUTES: RouteSpec[] = [
  // Public
  { name: 'landing',         path: '/',              role: 'public' },
  { name: 'login',           path: '/login',         role: 'public', waitFor: 'form' },
  { name: 'blog-index',      path: '/blog',          role: 'public' },
  { name: 'courses-catalog', path: '/courses',       role: 'public' },

  // Member
  { name: 'dashboard',            path: '/dashboard',                     role: 'member' },
  { name: 'enrolled-courses',     path: '/enrolled-courses',              role: 'member' },
  { name: 'notifications',        path: '/notifications',                 role: 'member' },
  { name: 'profile',              path: '/profile',                       role: 'member' },
  { name: 'calendar',             path: '/calendar',                      role: 'member' },
  { name: 'resume-analyzer',      path: '/resume-analyzer',               role: 'member' },
  { name: 'career-pathway',       path: '/career-pathway',                role: 'member' },
  // Wage bands render async, so wait for one before shooting or the baseline
  // captures a half-populated page and flakes.
  { name: 'explore-data-careers',  path: '/explore-data-careers',          role: 'member', waitFor: '[data-testid="wage-band"]' },

  // Admin
  { name: 'admin-dashboard',       path: '/admin',                        role: 'admin' },
  { name: 'admin-users',           path: '/admin/users',                  role: 'admin' },
  { name: 'admin-courses',         path: '/admin/courses',                role: 'admin' },
  { name: 'admin-activity',        path: '/admin/activity',               role: 'admin' },
  { name: 'admin-page-visibility', path: '/admin/page-visibility',        role: 'admin' },
];

test.describe('visual regression', () => {
  for (const route of ROUTES) {
    test(`${route.name} @ ${route.path}`, async ({ page }, testInfo) => {
      const role = (testInfo.project.metadata?.visualRole ?? 'public') as RouteRole;
      test.skip(role !== route.role, `route is ${route.role}-only`);

      await page.goto(route.path, { waitUntil: 'networkidle' });

      if (route.waitFor) {
        await page.waitForSelector(route.waitFor, { timeout: 10_000 });
      }

      // Stabilize: disable animations, hide obviously non-deterministic content.
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
      await page.evaluate(() => (document as any).fonts?.ready);
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
