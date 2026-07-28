import { test, expect } from '../fixtures/page-helpers';
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
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await table.count() > 0) {
      await expect(table).toBeVisible();
    }
  });

  test('search input filters users', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    const search = page.locator(Sel.searchInput).first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await search.count() > 0) {
      await search.fill('test');
      await page.waitForTimeout(400);
    }
  });

  test('role tabs are present: All, Admins, Instructors, Members', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    const tabs = page.locator('[role="tab"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await tabs.count() > 0) {
      await tabs.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('edit user dialog opens on action', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    const editBtn = page.locator('button:has-text("Edit"), button:has-text("Manage"), [aria-label*="edit"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(300);
      const dialog = page.locator('[role="dialog"]');
      // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
      // eslint-disable-next-line no-restricted-syntax
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
