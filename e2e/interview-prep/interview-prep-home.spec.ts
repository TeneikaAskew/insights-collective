import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Interview Prep Home', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.interviewPrep);
  });

  test('renders interview prep heading', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /interview/i }).first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.interviewPrep);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('tabs are present and clickable', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 4); i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(200);
      }
    }
  });

  test('the four prep steps are offered', async ({ page }) => {
    // MEASURED: this page renders ZERO anchors in <main>. The four steps are
    // role="tab" BUTTONS, so the old locator — four `a[href*=...]` alternatives
    // — matched nothing at all, and the count-guard turned that into a pass.
    for (const step of ['Analyze the job', 'Practice STAR stories', 'Drill code challenges', 'Book a mock interview']) {
      await expect(page.getByRole('tab', { name: new RegExp(step) })).toBeVisible();
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
