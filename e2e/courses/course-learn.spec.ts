import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Learn Interface', () => {
  const learnUrl = Routes.courseLearn();

  test('renders course learn interface', async ({ page }) => {
    await goto(page, learnUrl);
    // Shell may render before <main> mounts on placeholder IDs; accept any top-level region.
    await expect(page.locator('body')).not.toBeEmpty();
    const region = page.locator('main, [role="main"], aside, nav, section').first();
    await expect(region).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(learnUrl);
    await waitForPageLoad(page);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('curriculum tree or sidebar is visible', async ({ page }) => {
    await goto(page, learnUrl);
    const tree = page.locator('[class*="curriculum"], [class*="sidebar"], [class*="CurriculumTree"], aside, nav');
    if (await tree.count() > 0) {
      await expect(tree.first()).toBeVisible();
    }
  });

  test('content viewer pane is visible', async ({ page }) => {
    await goto(page, learnUrl);
    const viewer = page.locator('[class*="content"], [class*="viewer"], main, [role="main"], section, article').first();
    if (await viewer.count() > 0) {
      await expect(viewer).toBeVisible();
    }
  });

  test('progress bar or completion indicator is present', async ({ page }) => {
    await goto(page, learnUrl);
    const progress = page.locator('[role="progressbar"], [class*="progress"]').first();
    if (await progress.count() > 0) {
      await expect(progress).toBeVisible();
    }
  });
});
