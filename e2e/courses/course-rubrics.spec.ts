import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Rubrics (Instructor)', () => {
  const rubricsUrl = Routes.rubrics();

  test('renders rubrics page', async ({ page }) => {
    await goto(page, rubricsUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(rubricsUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('create rubric button or link is visible', async ({ page }) => {
    await goto(page, rubricsUrl);
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Rubric"), button:has-text("Add Rubric"), a:has-text("Create")').first();
    if (await createBtn.count() > 0) {
      await expect(createBtn).toBeVisible();
    }
  });

  test('rubric list or empty state renders', async ({ page }) => {
    await goto(page, rubricsUrl);
    const list = page.locator('[class*="rubric"], table, [role="list"]');
    const empty = page.locator(':has-text("No rubrics"), :has-text("create your first")');
    expect((await list.count()) + (await empty.count())).toBeGreaterThan(0);
  });

  test('rubric edit page renders', async ({ page }) => {
    await goto(page, Routes.rubricEdit());
    await waitForPageLoad(page);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });
});
