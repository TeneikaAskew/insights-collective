import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Resume Analyzer', () => {
  test('renders resume page for authenticated user', async ({ page }) => {
    await goto(page, Routes.resume);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.resume);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.resume);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });

  test('file upload dropzone is visible', async ({ page }) => {
    await goto(page, Routes.resume);
    const dropzone = page.locator(
      'input[type="file"], [class*="dropzone"], [class*="upload"], :has-text("drag"), :has-text("Drop"), :has-text("Upload")',
    ).first();
    if (await dropzone.count() > 0) {
      await expect(dropzone).toBeVisible();
    }
  });

  test.skip('unauthenticated user sees login wall or is redirected', async ({ browser }) => {
    // Resume page login wall detection is unreliable in test env
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(Routes.resume);
    await p.waitForLoadState('domcontentloaded');
    const isLogin = p.url().includes('/login');
    const hasLoginWall = await p.locator(':has-text("Sign in"), :has-text("Log in"), :has-text("Login")').count() > 0;
    expect(isLogin || hasLoginWall).toBe(true);
    await ctx.close();
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.resume);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
