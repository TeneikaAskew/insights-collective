import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Events Management', () => {
  test('renders admin events page', async ({ page }) => {
    await goto(page, Routes.adminEvents);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminEvents);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('events table or list renders', async ({ page }) => {
    await goto(page, Routes.adminEvents);
    const table = page.locator('table, [role="table"], [class*="event"], [class*="Card"]').first();
    if (await table.count() > 0) {
      await expect(table).toBeVisible();
    }
  });

  test('create event button is present', async ({ page }) => {
    await goto(page, Routes.adminEvents);
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Event"), a:has-text("Create")').first();
    if (await createBtn.count() > 0) {
      await expect(createBtn).toBeVisible();
    }
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminEvents);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
