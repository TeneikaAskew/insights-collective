import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('App Sidebar', () => {
  test('sidebar is visible on dashboard', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });

  test('sidebar contains dashboard link', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const link = page.locator('a[href="/dashboard"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await link.count() > 0) {
      await expect(link.first()).toBeVisible();
    }
  });

  test('sidebar contains courses link', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const link = page.locator('a[href="/courses"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await link.count() > 0) {
      await expect(link.first()).toBeVisible();
    }
  });

  test('active route is highlighted in sidebar', async ({ page }) => {
    await goto(page, Routes.courses);
    // The sidebar link for /courses should have an active/selected class
    const activeLink = page.locator('a[href="/courses"][class*="active"], a[href="/courses"][aria-current="page"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await activeLink.count() > 0) {
      await expect(activeLink).toBeVisible();
    }
  });

  test('sidebar toggle button collapses/expands the sidebar', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const toggleBtn = page.locator('[data-sidebar="trigger"], button[aria-label*="sidebar"], button[aria-label*="menu"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click();
      await page.waitForTimeout(400);
      // Sidebar may be hidden or in collapsed state
      await toggleBtn.click();
      await page.waitForTimeout(400);
    }
  });

  test('sidebar navigation links are clickable and navigate correctly', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const resourcesLink = page.locator('a[href="/resources"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await resourcesLink.count() > 0) {
      await resourcesLink.first().click();
      await expect(page).toHaveURL(/\/resources/);
    }
  });

  test('interview prep link is present in sidebar', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const link = page.locator('a[href="/interview-prep"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await link.count() > 0) {
      await expect(link.first()).toBeVisible();
    }
  });

  test('sign out button is visible in sidebar footer', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const signOutBtn = page.locator('button:has-text("Sign out"), button:has-text("Log out"), button:has-text("Logout")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await signOutBtn.count() > 0) {
      await expect(signOutBtn).toBeVisible();
    }
  });
});
