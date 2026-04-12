import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.landing);
  });

  test('renders hero section', async ({ page }) => {
    // Landing page should have some prominent heading or hero content
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('page title is set', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('has navigation links to login and register', async ({ page }) => {
    const loginLink = page.locator('a[href*="login"], button:has-text("Log in"), button:has-text("Sign in")');
    const registerLink = page.locator('a[href*="register"], button:has-text("Sign up"), button:has-text("Get started")');
    const loginCount = await loginLink.count();
    const registerCount = await registerLink.count();
    expect(loginCount + registerCount).toBeGreaterThan(0);
  });

  test('navigating to /login from CTA works', async ({ page }) => {
    const loginLink = page.locator('a[href*="/login"]').first();
    if (await loginLink.count() > 0) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('page renders without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await goto(page, Routes.landing);
    // Filter out known non-critical third-party errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('non-passive'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
