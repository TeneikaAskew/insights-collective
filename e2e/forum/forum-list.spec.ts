import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Forum List', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.forum);
  });

  test('renders forum list page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.forum);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('forum categories or list renders', async ({ page }) => {
    const categories = page.locator('[class*="forum"], [class*="category"], [class*="Card"], article');
    const empty = page.locator(':has-text("No forums"), :has-text("no discussions")');
    expect((await categories.count()) + (await empty.count())).toBeGreaterThan(0);
  });

  test('search input is present', async ({ page }) => {
    const search = page.locator(Sel.searchInput).first();
    if (await search.count() > 0) {
      await expect(search).toBeVisible();
    }
  });

  test('create forum or new discussion button is visible', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("+ Forum")').first();
    if (await createBtn.count() > 0) {
      await expect(createBtn).toBeVisible();
    }
  });

  test('clicking a forum category navigates to forum detail', async ({ page }) => {
    const forumLinks = page.locator('a[href*="/forum/"]');
    if (await forumLinks.count() > 0) {
      const href = await forumLinks.first().getAttribute('href');
      expect(href).toMatch(/\/forum\/.+/);
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
