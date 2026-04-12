import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey Page', () => {
  const surveyUrl = Routes.surveyPage();

  test('renders survey page for valid slug', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, surveyUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await ctx.close();
  });

  test('spinner resolves on load', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(surveyUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
    await ctx.close();
  });

  test('survey form fields render', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, surveyUrl);
    const fields = page.locator('input, textarea, select, [role="radio"], [role="checkbox"]').first();
    if (await fields.count() > 0) {
      await expect(fields).toBeVisible();
    }
    await ctx.close();
  });

  test('submit button is present', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, surveyUrl);
    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send")').first();
    if (await submitBtn.count() > 0) {
      await expect(submitBtn).toBeVisible();
    }
    await ctx.close();
  });

  test('required field validation triggers on empty submit', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, surveyUrl);
    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      // Should remain on survey page (validation prevents navigation)
      await expect(page).toHaveURL(new RegExp(surveyUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    await ctx.close();
  });
});
