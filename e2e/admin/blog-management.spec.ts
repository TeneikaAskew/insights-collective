import { test, expect } from '@playwright/test';
import { Routes } from '../helpers/route-helpers';

/**
 * Manage Blog — the authoring surface at /admin/blog.
 *
 * Runs under the chromium-admin project (storageState = admin session). If no
 * E2E credentials were supplied, global-setup leaves the session logged out and
 * these specs skip themselves rather than reporting a false pass.
 */

async function isSignedIn(page: import('@playwright/test').Page) {
  // The guard bounces unauthenticated users to /login and non-admins to
  // /dashboard, so landing anywhere else means we got in.
  return !/\/login|\/dashboard/.test(new URL(page.url()).pathname);
}

test.describe('Manage Blog (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(Routes.adminBlog, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    test.skip(!(await isSignedIn(page)), 'No admin session — E2E credentials not configured');
  });

  test('renders the posts list with its stat cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Blog Management' })).toBeVisible();
    await expect(page.getByText('Total Posts')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Posts/ })).toBeVisible();
  });

  test('admins see the Categories and Settings tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Categories/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Settings/ })).toBeVisible();
  });

  test('the status filter offers Featured', async ({ page }) => {
    // Covered here rather than in jsdom: opening a Radix Select needs real
    // pointer events.
    await page.getByRole('combobox').first().click();
    await expect(page.getByRole('option', { name: 'Featured' })).toBeVisible();
  });

  test('sorting controls are present and clickable', async ({ page }) => {
    for (const label of ['Title', 'Views', 'Date']) {
      const control = page.getByRole('button', { name: new RegExp(`^${label}$`) });
      await expect(control).toBeVisible();
      await control.click();
    }
  });

  test('the editor opens and offers a working in-form preview', async ({ page }) => {
    await page.goto(Routes.adminBlogNew, { waitUntil: 'domcontentloaded' });
    test.skip(!(await isSignedIn(page)), 'No admin session');

    await expect(page.getByRole('heading', { name: 'Create New Blog Post' })).toBeVisible();

    // REGRESSION: Preview used to open /blog/preview/:slug, an unrouted path
    // that always 404'd. It must now switch to an in-form tab.
    const previewTab = page.getByRole('tab', { name: /Preview/ });
    await expect(previewTab).toBeVisible();
    await previewTab.click();
    await expect(page.getByText(/Nothing to preview yet|Untitled Post/)).toBeVisible();
  });
});

// Instructor-role coverage lives in e2e/instructor/blog-authoring.spec.ts:
// this directory is claimed by the chromium-admin project, so a spec placed
// here always runs with the admin session.
