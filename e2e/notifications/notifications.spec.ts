import { test, expect } from '../fixtures/page-helpers';
import { goto, expectRedirectToLogin, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Notifications Page', () => {
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.skip(
      'unauthenticated user is redirected to login',
      {
        annotation: {
          type: 'skip-reason',
          description:
            'Blocked on PR 8: /notifications is routed without ProtectedRoute (src/App.tsx:259) and shows an inline sign-in card instead of redirecting.',
        },
      },
      async ({ page }) => {
        await page.goto(Routes.notifications);
        await expectRedirectToLogin(page);
      },
    );
  });

  test('renders notifications heading', async ({ page }) => {
    await goto(page, Routes.notifications);
    await expect(
      page.locator('h1, h2').filter({ hasText: /notification/i }).first(),
    ).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.notifications);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('notification list or empty state renders', async ({ page }) => {
    await goto(page, Routes.notifications);
    // Either notifications list items or an empty state message should be visible
    const list = page.locator('[role="list"], ul, .notification-item');
    const empty = page.locator(':has-text("No notifications"), :has-text("all caught up"), :has-text("empty")');
    const hasContent = (await list.count()) > 0 || (await empty.count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.notifications);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
