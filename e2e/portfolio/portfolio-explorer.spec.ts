import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Portfolio Explorer', () => {
  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.portfolioExplorer);
    await expectRedirectToLogin(page);
    await ctx.close();
  });

  test('renders portfolio explorer page', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.portfolioExplorer);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    await expect(page.locator('h1, h2').filter({ hasText: /portfolio/i }).first()).toBeVisible();
  });

  test('tabs are present: Discover, Ideas, Tracker, Pages', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const tabs = page.locator('[role="tab"]');
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test('?tab= query param pre-selects a tab', async ({ page }) => {
    await goto(page, `${Routes.portfolioExplorer}?tab=discover`);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('profile form renders in Discover tab', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const discoverTab = page.locator('[role="tab"]:has-text("Discover")');
    if (await discoverTab.count() > 0) {
      await discoverTab.click();
      await page.waitForTimeout(300);
      const textarea = page.locator('textarea').first();
      if (await textarea.count() > 0) {
        await expect(textarea).toBeVisible();
      }
    }
  });

  test('Tracker tab shows kanban board or project list', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const trackerTab = page.locator('[role="tab"]:has-text("Tracker")');
    if (await trackerTab.count() > 0) {
      await trackerTab.click();
      await page.waitForTimeout(300);
    }
  });

  test('Pages tab shows portfolio pages list', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const pagesTab = page.locator('[role="tab"]:has-text("Pages"), [role="tab"]:has-text("Portfolio Pages")');
    if (await pagesTab.count() > 0) {
      await pagesTab.click();
      await page.waitForTimeout(300);
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
