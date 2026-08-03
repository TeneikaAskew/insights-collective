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

  test('create rubric control is visible', async ({ page }) => {
    await goto(page, rubricsUrl);
    await expect(page.getByRole('button', { name: 'Create Rubric' })).toBeVisible();
  });

  test('the seeded rubric is listed', async ({ page }) => {
    await goto(page, rubricsUrl);
    // "body is not empty" was true of every error page too. The course has a
    // "Data Analysis Rubric"; naming it means an empty list fails.
    await expect(page.getByRole('heading', { name: 'Course Rubrics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Data Analysis Rubric' })).toBeVisible();
  });

  test('rubric edit page renders', async ({ page }) => {
    await goto(page, Routes.rubricEdit());
    await waitForPageLoad(page);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });
});
