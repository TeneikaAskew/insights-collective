import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey Admin Routes', () => {
  test('survey form create page auto-generates the slug from the title', async ({ page }) => {
    await goto(page, Routes.surveyFormCreate);

    await expect(page.locator('h1, h2').filter({ hasText: 'Create New Form' }).first()).toBeVisible();
    await page.fill('#title', 'Community Feedback Survey');
    await expect(page.locator('#slug')).toHaveValue('community-feedback-survey');
    await expect(page.locator('button:has-text("Create Form")')).toBeVisible();
  });

  test('survey form edit route fails gracefully when the form identifier cannot be resolved', async ({ page }) => {
    await page.goto(Routes.surveyFormEdit());
    await waitForPageLoad(page);

    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('body')).toContainText(/No form slug provided|Error/);
  });
});
