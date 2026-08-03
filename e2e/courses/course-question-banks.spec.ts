import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Question Banks (Instructor)', () => {
  const qbUrl = Routes.questionBanks();

  test('renders question banks page', async ({ page }) => {
    await goto(page, qbUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(qbUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('create question bank control is visible', async ({ page }) => {
    await goto(page, qbUrl);
    await expect(page.getByRole('button', { name: 'Create Question Bank' })).toBeVisible();
  });

  test('the question banks panel renders', async ({ page }) => {
    await goto(page, qbUrl);
    // "body is not empty" was true of every error page too.
    await expect(
      page.getByRole('heading', { name: 'Introduction to Data Science - Question Banks' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Question Banks' })).toBeVisible();
  });
});
