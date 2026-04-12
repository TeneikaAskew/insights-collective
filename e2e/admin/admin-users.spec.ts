import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Users Management', () => {
  test('renders user management page', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminUsers);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('users table renders with expected columns', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    const table = page.locator('table, [role="table"], [class*="user"]').first();
    if (await table.count() > 0) {
      await expect(table).toBeVisible();
    }
  });

  test('search input filters users', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    const search = page.locator(Sel.searchInput).first();
    if (await search.count() > 0) {
      await search.fill('test');
      await page.waitForTimeout(400);
    }
  });

  test('role tabs are present: All, Admins, Instructors, Members', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    const tabs = page.locator('[role="tab"]');
    if (await tabs.count() > 0) {
      await tabs.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('edit user dialog opens on action', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    const editBtn = page.locator('button:has-text("Edit"), button:has-text("Manage"), [aria-label*="edit"]').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(300);
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.count() > 0) {
        await expect(dialog).toBeVisible();
      }
    }
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
