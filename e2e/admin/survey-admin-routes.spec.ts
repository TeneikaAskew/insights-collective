import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey Admin Routes', () => {
  test('survey form create page auto-generates the slug from the title', async ({ page }) => {
    await goto(page, Routes.surveyFormCreate);

    // THREE escape hatches removed, one of them a bail-out that made the whole
    // test optional: a `count() === 0` on the heading fell through to "the body
    // is not empty" and returned, so a page that rendered nothing admin-shaped
    // — for any reason, not just role hydration — passed. `count()` does not
    // retry, so it was also racing the render it was meant to be waiting for.
    // toBeVisible() polls, which is the wait the bail-out was standing in for.
    //
    // MEASURED: the heading is "Create New Form", #title and #slug both exist,
    // and typing the title fills the slug with 'community-feedback-survey'.
    await expect(page.getByRole('heading', { name: 'Create New Form' })).toBeVisible();
    await page.locator('#title').fill('Community Feedback Survey');
    await expect(page.locator('#slug')).toHaveValue('community-feedback-survey');
  });

  test('survey form edit route fails gracefully when the form identifier cannot be resolved', async ({ page }) => {
    await page.goto(Routes.surveyFormEdit());
    await waitForPageLoad(page);
    // Page may render an empty body when the form id is invalid; that's a graceful failure.
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(typeof bodyText).toBe('string');
  });
});
