import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Privacy Policy', () => {
  test('page is accessible without authentication', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.privacyPolicy);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await ctx.close();
  });

  test('spinner resolves on load', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.privacyPolicy);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
    await ctx.close();
  });

  test('Privacy Policy heading is visible', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.privacyPolicy);
    await expect(
      page.locator('h1, h2').filter({ hasText: /privacy/i }).first(),
    ).toBeVisible();
    await ctx.close();
  });

  test('page content sections are present', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.privacyPolicy);
    const content = page.locator('p, section, article').first();
    await expect(content).toBeVisible();
    await ctx.close();
  });

  test('page does not redirect to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.privacyPolicy);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).not.toMatch(/\/login/);
    await ctx.close();
  });
});
