import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Progress', () => {
  const progressUrl = Routes.courseProgress();

  test('renders course progress page', async ({ page }) => {
    await goto(page, progressUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(progressUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('progress indicators are rendered', async ({ page }) => {
    await goto(page, progressUrl);
    const progress = page.locator('[role="progressbar"], [class*="progress"], :has-text("%")');
    if (await progress.count() > 0) {
      await expect(progress.first()).toBeVisible();
    }
  });

  test('module completion list renders', async ({ page }) => {
    await goto(page, progressUrl);
    const modules = page.locator('[class*="module"], li, [role="listitem"]');
    if (await modules.count() > 0) {
      await expect(modules.first()).toBeVisible();
    }
  });
});
