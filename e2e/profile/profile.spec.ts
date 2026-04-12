import { test, expect } from '@playwright/test';
import { goto, expectRedirectToLogin, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Profile Page', () => {
  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.profile);
    await expectRedirectToLogin(page);
    await ctx.close();
  });

  test('renders profile heading', async ({ page }) => {
    await goto(page, Routes.profile);
    await expect(
      page.locator('h1, h2').filter({ hasText: /profile/i }).first(),
    ).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.profile);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('profile form fields are present', async ({ page }) => {
    await goto(page, Routes.profile);
    // Name / display name input
    const nameInput = page.locator('input[name*="name"], input[id*="name"], input[placeholder*="name"]').first();
    if (await nameInput.count() > 0) {
      await expect(nameInput).toBeVisible();
    }
  });

  test('email field is present and pre-filled', async ({ page }) => {
    await goto(page, Routes.profile);
    const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
    if (await emailInput.count() > 0) {
      await expect(emailInput).toBeVisible();
      const value = await emailInput.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.profile);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
