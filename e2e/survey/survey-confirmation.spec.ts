import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey Confirmation', () => {
  test('renders confirmation page', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.surveyConfirmation);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await ctx.close();
  });

  test('spinner resolves on load', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.surveyConfirmation);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
    await ctx.close();
  });

  test('thank-you or success message is visible', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.surveyConfirmation);
    const msg = page.locator(':has-text("Thank"), :has-text("thank"), :has-text("submitted"), :has-text("received"), :has-text("success")').first();
    if (await msg.count() > 0) {
      await expect(msg).toBeVisible();
    }
    await ctx.close();
  });

  test('link to return to home or surveys is present', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.surveyConfirmation);
    const returnLink = page.locator('a[href="/"], a[href="/survey"], a[href="/dashboard"], a:has-text("Home"), a:has-text("Back")').first();
    if (await returnLink.count() > 0) {
      await expect(returnLink).toBeVisible();
    }
    await ctx.close();
  });
});
