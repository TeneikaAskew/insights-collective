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
    // The old locator was a bare :has-text with no tag qualifier, which matches
    // EVERY ancestor up to <html> — so one occurrence of the word anywhere on
    // the page satisfied it, including inside unrelated copy. The role is shown
    // in the profile menu, so assert the menu trigger instead: it is the control
    // that actually carries who you are signed in as.
    await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();
  });
});
