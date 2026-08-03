import { test, expect } from '../fixtures/page-helpers';
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
    // `footer` alone. The old locator's [class*="footer"] alternative matches any
    // wrapper whose class merely mentions the word, so it could not tell a
    // rendered footer from a div that happened to be named after one.
    const footer = page.locator('footer').filter({ visible: true }).first();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
  });

  test('navbar / topbar renders', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(page.locator('header').filter({ visible: true }).first()).toBeVisible();
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
    // The role label lives in the SIDEBAR (AppSidebar.tsx), and only when the
    // sidebar is expanded — `open &&` gates it, and AppLayout starts collapsed.
    // Measured: 0 matches before expanding, 1 after.
    //
    // The old locator was a bare :has-text with no tag qualifier, matching every
    // ancestor up to <html>, so the word "Member" anywhere passed. My first
    // replacement asserted the User menu button, which carries no role at all —
    // green even with the label gone.
    const rail = page.locator('[data-sidebar="rail"]').filter({ visible: true }).first();
    await rail.click();

    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.getByText('Member', { exact: true })).toBeVisible();
  });
});
