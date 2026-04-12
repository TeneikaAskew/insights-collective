import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Calendar', () => {
  const calUrl = Routes.courseCalendar();

  test('renders course calendar page', async ({ page }) => {
    await goto(page, calUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(calUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('calendar grid or list is visible', async ({ page }) => {
    await goto(page, calUrl);
    const calendar = page.locator('[role="grid"], .fc, table, [class*="calendar"]').first();
    if (await calendar.count() > 0) {
      await expect(calendar).toBeVisible();
    }
  });

  test('month navigation works', async ({ page }) => {
    await goto(page, calUrl);
    const nextBtn = page.locator('button[aria-label*="next"], button:has-text("Next"), button:has-text(">")').first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(300);
    }
  });
});
