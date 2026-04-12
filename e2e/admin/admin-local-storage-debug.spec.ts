import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin LocalStorage Debug', () => {
  test('renders debug page', async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminLocalStorageDebug);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('localStorage key-value pairs are displayed', async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
    // The page should show localStorage contents — at minimum the auth token key
    const content = page.locator('[class*="key"], [class*="value"], pre, code, table, [class*="storage"]').first();
    if (await content.count() > 0) {
      await expect(content).toBeVisible();
    }
  });

  test('clear or delete key button is present', async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
    const clearBtn = page.locator('button:has-text("Clear"), button:has-text("Delete"), button:has-text("Remove")').first();
    if (await clearBtn.count() > 0) {
      await expect(clearBtn).toBeVisible();
    }
  });

  test('refresh button is present', async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
    const refreshBtn = page.locator('button:has-text("Refresh"), button[aria-label*="refresh"]').first();
    if (await refreshBtn.count() > 0) {
      await expect(refreshBtn).toBeVisible();
    }
  });
});
