import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Social Archive Pages', () => {
  // These specs test the archive pages themselves, not the visibility gate
  // (e2e/navigation/page-visibility.spec.ts covers gating). The live table
  // deliberately hides /teneika-linkedin, so stub both pages visible here.
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/page_visibility*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'e2e-li', page_path: '/teneika-linkedin', page_name: 'Teneika LinkedIn', visible_to_users: true, visible_to_instructors: true },
            { id: 'e2e-tw', page_path: '/teneika-tweets', page_name: 'Teneika Tweets', visible_to_users: true, visible_to_instructors: true },
          ]),
        });
        return;
      }
      await route.continue();
    });
  });

  test('linkedin archive renders filters and refresh affordance', async ({ page }) => {
    await goto(page, Routes.teneikaLinkedIn);
    await expect(page.locator('h1:has-text("LinkedIn Posts")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search posts"]')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh Posts")')).toBeVisible();
  });

  // This project signs in as a member, which is what makes the negative
  // assertions below worth having: the import control is admin-only, and a
  // non-admin session is the case that must never see it.
  //
  // The "Refresh Tweets" button this used to assert has been removed. It invoked
  // scrape-teneika-tweets, which is behind requireAdminOrService, so for the very
  // member session this spec runs as it could only ever return 401 and raise a
  // failure toast.
  test('tweets archive renders filters, and no scrape or import control for a member', async ({ page }) => {
    await goto(page, Routes.teneikaTweets);
    await expect(page.locator('h1:has-text("Tweets")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search tweets"]')).toBeVisible();

    await expect(page.locator('button:has-text("Refresh Tweets")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Scrape Tweets")')).toHaveCount(0);
    await expect(page.getByTestId('import-archive-button')).toHaveCount(0);
  });
});
