// ABOUTME: Visual regression tests — screenshot key routes and diff against baselines.
// ABOUTME: Each route opens a per-role authenticated context (public routes stay
// ABOUTME: unauthenticated) so every route actually runs — no role-gated skips.

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(process.cwd(), '.playwright-sessions');

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

  // Admin
  { name: 'admin-dashboard',       path: '/admin',                        role: 'admin' },
  { name: 'admin-users',           path: '/admin/users',                  role: 'admin' },
  { name: 'admin-courses',         path: '/admin/courses',                role: 'admin' },
  { name: 'admin-activity',        path: '/admin/activity',               role: 'admin' },
  { name: 'admin-page-visibility', path: '/admin/page-visibility',        role: 'admin' },
];

function storageStateFor(role: RouteRole): string | undefined {
  if (role === 'public') return undefined;
  return path.join(SESSIONS_DIR, `${role}.json`);
}

test.describe('visual regression', () => {
  for (const route of ROUTES) {
    test(`${route.name} @ ${route.path} [${route.role}]`, async ({ browser }) => {
      // Open a fresh context with the correct role's saved session (or none for
      // public routes). This lets the single 'visual' project execute every
      // route without skipping — the login is the persisted storageState.
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        storageState: storageStateFor(route.role),
      });
      const page = await context.newPage();

      try {
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

        // admin-activity renders live event rows whose spacing and count drift
        // slightly between runs; give it a wider tolerance than the rest.
        const maxDiffPixelRatio = route.name === 'admin-activity' ? 0.05 : 0.01;
        await expect(page).toHaveScreenshot(`${route.name}.png`, {
          fullPage: route.fullPage ?? true,
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio,
        });
      } finally {
        await context.close();
      }
    });
  }
});
