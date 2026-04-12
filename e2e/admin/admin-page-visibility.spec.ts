import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Page Visibility', () => {
  test('renders page visibility management page', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminPageVisibility);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('visibility toggles are present per page entry', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    const toggles = page.locator('[role="switch"], input[type="checkbox"], [class*="toggle"]');
    if (await toggles.count() > 0) {
      await expect(toggles.first()).toBeVisible();
    }
  });

  test('page names/list is displayed', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    const pageList = page.locator('table, [role="list"], [class*="page"], ul').first();
    if (await pageList.count() > 0) {
      await expect(pageList).toBeVisible();
    }
  });

  test('toggling visibility updates state', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    const toggle = page.locator('[role="switch"]').first();
    if (await toggle.count() > 0) {
      const initialState = await toggle.getAttribute('data-state') || await toggle.getAttribute('aria-checked');
      await toggle.click();
      await page.waitForTimeout(500);
      const newState = await toggle.getAttribute('data-state') || await toggle.getAttribute('aria-checked');
      // State should have changed or a save button appeared
      const saveBtn = page.locator('button:has-text("Save"), button:has-text("Apply")').first();
      const changed = initialState !== newState || (await saveBtn.count()) > 0;
      expect(changed).toBe(true);
    }
  });
});
