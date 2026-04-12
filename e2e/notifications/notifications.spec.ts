import { test, expect } from '@playwright/test';
import { goto, expectRedirectToLogin, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Notifications Page', () => {
  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.notifications);
    await expectRedirectToLogin(page);
    await ctx.close();
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
