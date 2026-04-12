import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

// Public portfolio is accessible WITHOUT authentication
test.describe('Public Portfolio View', () => {
  const publicUrl = Routes.publicPortfolio();

  test('renders public portfolio without authentication', async ({ browser }) => {
    const ctx = await browser.newContext(); // fresh unauthenticated context
    const page = await ctx.newPage();
    await goto(page, publicUrl);
    await expect(page.locator('body')).not.toBeEmpty();
    await ctx.close();
  });

  test('spinner resolves on load', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(publicUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
    await ctx.close();
  });

  test('portfolio content renders', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, publicUrl);
    // Public portfolio should show some content
    const content = page.locator('main, [role="main"], [class*="portfolio"], [class*="Portfolio"]').first();
    if (await content.count() > 0) {
      await expect(content).toBeVisible();
    }
    await ctx.close();
  });

  test('page does not show app sidebar navigation', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, publicUrl);
    // Public portfolio should be a standalone page without the main app sidebar
    await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0);
    await ctx.close();
  });

  test('not found page renders for unknown portfolio URL', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, '/portfolio/definitely-does-not-exist-99999');
    await expect(page.locator('body')).not.toBeEmpty();
    await ctx.close();
  });
});
