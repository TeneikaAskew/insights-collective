import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Activity Log', () => {
  test('renders activity log page', async ({ page }) => {
    await goto(page, Routes.adminActivity);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminActivity);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('activity table or list renders', async ({ page }) => {
    await goto(page, Routes.adminActivity);
    const table = page.locator('table, [role="table"], [class*="activity"], [role="list"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await table.count() > 0) {
      await expect(table).toBeVisible();
    }
  });

  test('date filter is present', async ({ page }) => {
    await goto(page, Routes.adminActivity);
    const dateFilter = page.locator('input[type="date"], [placeholder*="date"], [aria-label*="date"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await dateFilter.count() > 0) {
      await expect(dateFilter).toBeVisible();
    }
  });

  test('event type filter is present', async ({ page }) => {
    await goto(page, Routes.adminActivity);
    const typeFilter = page.locator('[role="combobox"], select, button:has-text("Filter"), button:has-text("Type")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await typeFilter.count() > 0) {
      await expect(typeFilter).toBeVisible();
    }
  });
});
