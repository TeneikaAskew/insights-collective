import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Additional Admin Route Coverage', () => {
  test('unified form management renders tabs and opens the create form dialog', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);

    // Both guards removed: the heading IS "Form Management" and the button IS
    // "New Form" — measured. Guarded, this test's whole body was optional, so
    // it reported success on a page that rendered neither, which is precisely
    // what a route-COVERAGE spec exists to catch.
    await expect(page.getByRole('heading', { name: 'Form Management' })).toBeVisible();

    // The test's name promises tabs; it never checked for any.
    for (const tab of ['All Forms', 'Templates', 'Analytics']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }

    await page.getByRole('button', { name: 'New Form' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('form-management route without a slug shows a recoverable error state', async ({ page }) => {
    await page.goto(Routes.adminFormManagement);
    await waitForPageLoad(page);

    await expect(page.locator('text=No form specified')).toBeVisible();
    await expect(page.locator('button:has-text("Return to forms")')).toBeVisible();
  });
});
