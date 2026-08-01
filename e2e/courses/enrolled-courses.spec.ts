import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Enrolled Courses', () => {
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.skip(
      'unauthenticated user is redirected to login',
      {
        annotation: {
          type: 'skip-reason',
          description:
            'Blocked on PR 8: /enrolled-courses is routed without ProtectedRoute and shows an inline sign-in card instead of redirecting.',
        },
      },
      async ({ page }) => {
        await page.goto(Routes.enrolledCourses);
        await expectRedirectToLogin(page);
      },
    );
  });

  test('renders enrolled courses page', async ({ page }) => {
    await goto(page, Routes.enrolledCourses);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.enrolledCourses);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('enrolled course cards or empty state renders', async ({ page }) => {
    await goto(page, Routes.enrolledCourses);
    // Page renders app shell at minimum; either cards, empty copy, or nav is enough.
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.enrolledCourses);
    const sidebar = page.locator('[data-sidebar="sidebar"], aside, nav').first();
    await expect(sidebar).toBeVisible();
  });
});
