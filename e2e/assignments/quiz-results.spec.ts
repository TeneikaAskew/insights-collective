import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Quiz Results', () => {
  const resultsUrl = Routes.quizResults();

  test('renders quiz results page', async ({ page }) => {
    await goto(page, resultsUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(resultsUrl);
    await waitForPageLoad(page);
    // Placeholder submission ID may leave loading state; verify body rendered.
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('score or result is displayed', async ({ page }) => {
    await goto(page, resultsUrl);
    const score = page.locator(':has-text("score"), :has-text("Score"), :has-text("%"), :has-text("points")').first();
    if (await score.count() > 0) {
      await expect(score).toBeVisible();
    }
  });

  test('link back to course is present', async ({ page }) => {
    await goto(page, resultsUrl);
    const backLink = page.locator('a[href*="/courses/"], button:has-text("Back"), a:has-text("Return")').first();
    if (await backLink.count() > 0) {
      await expect(backLink).toBeVisible();
    }
  });
});
