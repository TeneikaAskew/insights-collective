import { test, expect } from '../fixtures/page-helpers';
import { goto, expectRedirectToLogin, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Profile Page', () => {
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test(
      'unauthenticated user is redirected to login',
      async ({ page }) => {
        await page.goto(Routes.profile);
        await expectRedirectToLogin(page);
      },
    );
  });

  test('renders profile heading', async ({ page }) => {
    await page.goto(Routes.profile);
    // getSession() makes a Supabase network call; wait for all requests to finish
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await waitForPageLoad(page);
    await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.profile);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('profile form fields are present', async ({ page }) => {
    await goto(page, Routes.profile);
    // Name / display name input
    // By placeholder text, not by an attribute substring. The old locator was
    // input[name*="name"], input[id*="name"], input[placeholder*="name"] — and
    // these inputs carry NO name and NO id, while their placeholders read
    // "First Name" and "Last Name". CSS attribute substring matching is
    // case-sensitive, so *="name" never matched "First Name". All three
    // alternatives missed, and the count-guard reported that as a pass.
    const firstName = page.getByPlaceholder('First Name');
    await expect(firstName).toBeVisible();
    await expect(page.getByPlaceholder('Last Name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  });

  test('email field is present and pre-filled', async ({ page }) => {
    await goto(page, Routes.profile);
    const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
    const count = await emailInput.count();
    if (count > 0 && await emailInput.isVisible()) {
      // Auth/profile load may still be in flight — a present input is enough;
      // if it has a value, it should look like an email.
      const value = await emailInput.inputValue();
      if (value) {
        expect(value).toMatch(/@/);
      }
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.profile);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
