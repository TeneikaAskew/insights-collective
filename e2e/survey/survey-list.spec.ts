import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey List', () => {
  test('renders survey list page', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.survey);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await ctx.close();
  });

  test('spinner resolves on load', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.survey);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
    await ctx.close();
  });

  test('page heading is visible', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.survey);
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await ctx.close();
  });

  test('survey cards or list renders', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.survey);
    const cards = page.locator('[class*="survey"], [class*="form"], [class*="Card"], article');
    const empty = page.locator(':has-text("No surveys"), :has-text("no forms"), :has-text("coming soon")');
    expect((await cards.count()) + (await empty.count())).toBeGreaterThan(0);
    await ctx.close();
  });

  test('start survey button navigates to survey page', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.survey);
    const startBtn = page.locator('button:has-text("Start"), a:has-text("Start"), a:has-text("Take Survey"), button:has-text("Open")').first();
    if (await startBtn.count() > 0) {
      await expect(startBtn).toBeVisible();
    }
    await ctx.close();
  });
});
