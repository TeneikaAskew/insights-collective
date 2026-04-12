import { test, expect } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Auth Callback', () => {
  test('renders without crashing when no hash fragment is present', async ({ page }) => {
    await page.goto(Routes.authCallback);
    // Page should not throw or show a blank screen; it may redirect or show a loader
    await page.waitForLoadState('domcontentloaded');
    // The body should exist and not be empty
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('legacy /auth-callback route does not 404', async ({ page }) => {
    const response = await page.goto('/auth-callback');
    expect(response?.status()).not.toBe(404);
  });

  test('recovery type param is handled gracefully', async ({ page }) => {
    await page.goto(`${Routes.authCallback}?type=recovery`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
