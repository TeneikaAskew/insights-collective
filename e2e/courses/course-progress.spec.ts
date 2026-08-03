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
    // role=progressbar only. The old locator also accepted [class*="progress"]
    // (matches the page wrapper) and a bare :has-text("%") with no tag
    // qualifier, which matches every ancestor up to <html> — so a stray percent
    // sign anywhere satisfied it.
    await expect(page.getByRole('heading', { name: 'Overall Progress' })).toBeVisible();
    const bars = page.locator('[role="progressbar"]');
    await expect(bars.first()).toBeVisible();
    expect(await bars.count()).toBeGreaterThan(1);
  });

  test('module completion list renders', async ({ page }) => {
    await goto(page, progressUrl);
    // Named modules. The old locator accepted a bare `li`, so the navigation's
    // list items satisfied it on any page that rendered at all.
    await expect(page.getByRole('heading', { name: 'Module Progress' })).toBeVisible();
    for (const m of ['Foundations of Data Science', 'Python for Data Analysis', 'Statistical Methods']) {
      await expect(page.getByText(m, { exact: true }).first()).toBeVisible();
    }
  });
});
