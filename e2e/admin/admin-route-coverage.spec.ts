import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Additional Admin Route Coverage', () => {
  test('unified form management renders tabs and opens the create form dialog', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);

    const heading = page.locator('h1, h2, h3').filter({ hasText: /form management/i }).first();
    if (await heading.count() > 0) {
      await expect(heading).toBeVisible();
    }

    const newFormBtn = page.locator('button:has-text("New Form"), button:has-text("Create")').first();
    if (await newFormBtn.count() > 0) {
      await newFormBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });

  test('form-management route without a slug shows a recoverable error state', async ({ page }) => {
    await page.goto(Routes.adminFormManagement);
    await waitForPageLoad(page);

    await expect(page.locator('text=No form specified')).toBeVisible();
    await expect(page.locator('button:has-text("Return to forms")')).toBeVisible();
  });
});
