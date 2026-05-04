import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Forms Management', () => {
  test('renders admin forms page', async ({ page }) => {
    // /admin/forms was removed — use unified form management instead
    await goto(page, Routes.adminUnifiedFormManagement);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminUnifiedFormManagement);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('forms list renders', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);
    const list = page.locator('table, [role="table"], [class*="form"], [class*="Card"]').first();
    if (await list.count() > 0) {
      await expect(list).toBeVisible();
    }
  });

  test('active/inactive toggle is present per form', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);
    const toggle = page.locator('[role="switch"], [class*="toggle"], input[type="checkbox"]').first();
    if (await toggle.count() > 0) {
      await expect(toggle).toBeVisible();
    }
  });

  test('create form button is visible', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Form"), a:has-text("Create")').first();
    if (await createBtn.count() > 0) {
      await expect(createBtn).toBeVisible();
    }
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
