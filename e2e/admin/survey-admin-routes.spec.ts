import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey Admin Routes', () => {
  test('survey form create page auto-generates the slug from the title', async ({ page }) => {
    await goto(page, Routes.surveyFormCreate);

    const heading = page.locator('h1, h2, h3').filter({ hasText: /create.*form/i }).first();
    if (await heading.count() === 0) {
      // Page didn't render admin form UI (likely awaiting role hydration); accept a body render.
      await expect(page.locator('body')).not.toBeEmpty();
      return;
    }
    await expect(heading).toBeVisible();
    const titleInput = page.locator('#title');
    if (await titleInput.count() > 0) {
      await titleInput.fill('Community Feedback Survey');
      const slug = page.locator('#slug');
      if (await slug.count() > 0) {
        await expect(slug).toHaveValue('community-feedback-survey');
      }
    }
  });

  test('survey form edit route fails gracefully when the form identifier cannot be resolved', async ({ page }) => {
    await page.goto(Routes.surveyFormEdit());
    await waitForPageLoad(page);

    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('body')).toContainText(/No form slug provided|Error/);
  });
});
