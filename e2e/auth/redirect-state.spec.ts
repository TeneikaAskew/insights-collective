import { test, expect } from '../fixtures/page-helpers';
import { expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Auth Redirect State', () => {
  test('protected route stores redirect path before sending public user to login', async ({ page }) => {
    const targetPath = `${Routes.portfolioExplorer}?tab=pages`;

    await page.goto(targetPath);
    await expectRedirectToLogin(page);

    const storedRedirect = await page.evaluate(() => localStorage.getItem('redirectAfterLogin'));
    expect(storedRedirect).toBe(targetPath);
  });

  test('slugged survey confirmation route resolves without falling through to 404', async ({ page }) => {
    const response = await page.goto(Routes.surveyConfirmationSlug());

    expect(response?.status()).not.toBe(404);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=Oops! Page not found')).toHaveCount(0);
  });
});
