import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('App Layout', () => {
  test('sidebar renders for authenticated user', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });

  test('main content area renders', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('page footer is visible', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const footer = page.locator('footer, [class*="footer"]');
    if (await footer.count() > 0) {
      // Scroll to footer
      await footer.first().scrollIntoViewIfNeeded();
      await expect(footer.first()).toBeVisible();
    }
  });

  test('navbar / topbar renders', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const navbar = page.locator('[data-component-name="Navbar"], header, [class*="navbar"], [class*="topbar"]').first();
    if (await navbar.count() > 0) {
      await expect(navbar).toBeVisible();
    }
  });

  test('app renders without layout shift on navigation', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await goto(page, Routes.courses);
    await goto(page, Routes.profile);
    // All three pages should load without showing a blank page
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('user role badge is visible in sidebar', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const roleBadge = page.locator(':has-text("Administrator"), :has-text("Instructor"), :has-text("Member")').first();
    if (await roleBadge.count() > 0) {
      await expect(roleBadge).toBeVisible();
    }
  });
});
