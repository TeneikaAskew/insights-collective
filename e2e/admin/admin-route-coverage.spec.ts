import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Additional Admin Route Coverage', () => {
  test('unified form management renders tabs and opens the create form dialog', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);

    await expect(page.locator('h1:has-text("Unified Form Management")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("All Forms")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Templates")')).toBeVisible();
    await expect(page.locator('button:has-text("New Form")')).toBeVisible();

    await page.click('button:has-text("New Form")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"] input#title')).toBeVisible();
  });

  test('form-management route without a slug shows a recoverable error state', async ({ page }) => {
    await page.goto(Routes.adminFormManagement);
    await waitForPageLoad(page);

    await expect(page.locator('text=No form specified')).toBeVisible();
    await expect(page.locator('button:has-text("Return to forms")')).toBeVisible();
  });
});
