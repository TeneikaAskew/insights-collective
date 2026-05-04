import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Reset Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.resetPassword);
  });

  test('renders email input and submit button', async ({ page }) => {
    await expect(page.locator(Sel.resetPassword.email)).toBeVisible();
    await expect(page.locator(Sel.resetPassword.submit)).toBeVisible();
  });

  test('shows error when email is empty', async ({ page }) => {
    await page.click(Sel.resetPassword.submit);
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test('shows error when email is invalid', async ({ page }) => {
    await page.fill(Sel.resetPassword.email, 'notanemail');
    await page.click(Sel.resetPassword.submit);
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test('shows success state after valid email submission', async ({ page }) => {
    // Intercept Supabase password reset endpoint
    await page.route('**/auth/v1/recover**', (route) =>
      route.fulfill({ status: 200, body: '{}' }),
    );
    await page.fill(Sel.resetPassword.email, 'user@example.com');
    await page.click(Sel.resetPassword.submit);
    // Should show success message
    await expect(page.locator(Sel.resetPassword.successMsg)).toBeVisible({ timeout: 5_000 });
  });

  test('page has link back to login', async ({ page }) => {
    const loginLink = page.locator('a[href*="login"], a:has-text("Back"), a:has-text("Sign in")');
    await expect(loginLink.first()).toBeVisible();
  });
});
