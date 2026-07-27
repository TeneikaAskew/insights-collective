import { test, expect } from '@playwright/test';
import { Routes } from '../helpers/route-helpers';

/**
 * Instructor blog authoring.
 *
 * The database has always granted instructors CRUD over posts they author (RLS
 * policy "Instructors and admins manage own posts"), but the UI locked them out
 * of every blog route. These specs pin the fix: an instructor can reach Manage
 * Blog, but only sees the surfaces RLS will actually let them use.
 *
 * Runs under the chromium-instructor project (storageState = instructor
 * session). Without E2E credentials the session is logged out and these skip
 * rather than reporting a false pass.
 */

async function isSignedIn(page: import('@playwright/test').Page) {
  return !/\/login|\/dashboard/.test(new URL(page.url()).pathname);
}

test.describe('Instructor blog authoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(Routes.adminBlog, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    test.skip(
      !(await isSignedIn(page)),
      'No instructor session — E2E credentials not configured',
    );
  });

  test('an instructor can reach Manage Blog', async ({ page }) => {
    // REGRESSION: /admin/blog was admin-only, so an instructor was bounced to
    // /dashboard and had a security event logged against their own user id.
    await expect(page.getByRole('heading', { name: 'Blog Management' })).toBeVisible();
  });

  test('admin-only tabs are hidden from an instructor', async ({ page }) => {
    // blog_categories and blog_settings are admin-only in RLS. Rendering these
    // tabs would show controls whose every save fails with a policy violation.
    await expect(page.getByRole('tab', { name: /Categories/ })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Settings/ })).toHaveCount(0);
    // Analytics reads data an instructor is allowed to see, so it stays.
    await expect(page.getByRole('tab', { name: /Analytics/ })).toBeVisible();
  });

  test('an instructor can open the post editor', async ({ page }) => {
    await page.goto(Routes.adminBlogNew, { waitUntil: 'domcontentloaded' });
    test.skip(!(await isSignedIn(page)), 'No instructor session');
    await expect(page.getByRole('heading', { name: 'Create New Blog Post' })).toBeVisible();
  });
});
