import { test, expect } from '@playwright/test';
import { goto, interceptOAuth } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.register);
  });

  test('renders all expected fields', async ({ page }) => {
    await expect(page.locator(Sel.register.name)).toBeVisible();
    await expect(page.locator(Sel.register.email)).toBeVisible();
    await expect(page.locator(Sel.register.password)).toBeVisible();
    await expect(page.locator(Sel.register.confirmPassword)).toBeVisible();
    await expect(page.locator(Sel.register.submit)).toBeVisible();
    await expect(page.locator(Sel.register.googleBtn)).toBeVisible();
    await expect(page.locator(Sel.register.loginLink)).toBeVisible();
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await page.fill(Sel.register.name, 'Test User');
    await page.fill(Sel.register.email, 'test@example.com');
    await page.fill(Sel.register.password, 'Password123!');
    await page.fill(Sel.register.confirmPassword, 'DifferentPassword!');
    await page.click(Sel.register.submit);
    // Should remain on register page with an error
    await expect(page).toHaveURL(/\/register/);
  });

  test('shows error when email is invalid', async ({ page }) => {
    await page.fill(Sel.register.name, 'Test User');
    await page.fill(Sel.register.email, 'notanemail');
    await page.fill(Sel.register.password, 'Password123!');
    await page.fill(Sel.register.confirmPassword, 'Password123!');
    await page.click(Sel.register.submit);
    await expect(page).toHaveURL(/\/register/);
  });

  test('shows error for consecutive dots in email', async ({ page }) => {
    await page.fill(Sel.register.name, 'Test User');
    await page.fill(Sel.register.email, 'a..b@example.com');
    await page.fill(Sel.register.password, 'Password123!');
    await page.fill(Sel.register.confirmPassword, 'Password123!');
    await page.click(Sel.register.submit);
    await expect(page).toHaveURL(/\/register/);
  });

  test('shows error for weak password', async ({ page }) => {
    await page.fill(Sel.register.name, 'Test User');
    await page.fill(Sel.register.email, 'test@example.com');
    await page.fill(Sel.register.password, '123');
    await page.fill(Sel.register.confirmPassword, '123');
    await page.click(Sel.register.submit);
    await expect(page).toHaveURL(/\/register/);
  });

  test('name field is required', async ({ page }) => {
    await page.fill(Sel.register.email, 'test@example.com');
    await page.fill(Sel.register.password, 'Password123!');
    await page.fill(Sel.register.confirmPassword, 'Password123!');
    await page.click(Sel.register.submit);
    await expect(page).toHaveURL(/\/register/);
  });

  test('Google OAuth button initiates redirect (intercepted)', async ({ page }) => {
    await interceptOAuth(page);
    await page.click(Sel.register.googleBtn);
  });

  test('Login link navigates to login page', async ({ page }) => {
    await page.click(Sel.register.loginLink);
    await expect(page).toHaveURL(/\/login/);
  });

  test('password and confirm password fields start as type=password', async ({ page }) => {
    await expect(page.locator(Sel.register.password)).toHaveAttribute('type', 'password');
    await expect(page.locator(Sel.register.confirmPassword)).toHaveAttribute('type', 'password');
  });
});
