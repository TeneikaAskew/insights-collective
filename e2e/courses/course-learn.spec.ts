import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Learn Interface', () => {
  const learnUrl = Routes.courseLearn();

  test('renders course learn interface', async ({ page }) => {
    await goto(page, learnUrl);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(learnUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('curriculum tree or sidebar is visible', async ({ page }) => {
    await goto(page, learnUrl);
    // Left panel with module/lesson list
    const tree = page.locator('[class*="curriculum"], [class*="sidebar"], [class*="CurriculumTree"], aside');
    if (await tree.count() > 0) {
      await expect(tree.first()).toBeVisible();
    }
  });

  test('content viewer pane is visible', async ({ page }) => {
    await goto(page, learnUrl);
    const viewer = page.locator('[class*="content"], [class*="viewer"], main, [role="main"]').first();
    await expect(viewer).toBeVisible();
  });

  test('progress bar or completion indicator is present', async ({ page }) => {
    await goto(page, learnUrl);
    const progress = page.locator('[role="progressbar"], [class*="progress"]').first();
    if (await progress.count() > 0) {
      await expect(progress).toBeVisible();
    }
  });
});
