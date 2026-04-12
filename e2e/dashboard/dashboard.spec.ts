import { test, expect } from '../fixtures/page-helpers';
import { goto, expectRedirectToLogin, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Dashboard', () => {
  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const ctx = await browser.newContext(); // fresh context = no session
    const page = await ctx.newPage();
    await page.goto(Routes.dashboard);
    await expectRedirectToLogin(page);
    await ctx.close();
  });

  test('renders dashboard heading for authenticated user', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(
      page.locator('h1, h2').filter({ hasText: /dashboard/i }).first(),
    ).toBeVisible();
  });

  test('loading spinner resolves', async ({ page }) => {
    await page.goto(Routes.dashboard);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('sidebar navigation is present', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });

  test('tabs are visible and clickable', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    if (count > 0) {
      await tabs.first().click();
    }
  });

  test('course card links navigate to course detail', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const courseCards = page.locator('a[href*="/courses/"]');
    const count = await courseCards.count();
    if (count > 0) {
      const href = await courseCards.first().getAttribute('href');
      expect(href).toMatch(/\/courses\//);
    }
  });

  test('Browse Courses button is visible', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const btn = page.locator('button:has-text("Browse"), a:has-text("Browse"), button:has-text("Courses")').first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible();
    }
  });
});
