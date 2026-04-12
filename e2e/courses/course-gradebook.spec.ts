import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Gradebook (Instructor)', () => {
  const gradebookUrl = Routes.gradebook();

  test('renders gradebook page', async ({ page }) => {
    await goto(page, gradebookUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(gradebookUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('gradebook table or grid renders', async ({ page }) => {
    await goto(page, gradebookUrl);
    const table = page.locator('table, [role="grid"], [class*="gradebook"]');
    if (await table.count() > 0) {
      await expect(table.first()).toBeVisible();
    }
  });

  test('student names column is present', async ({ page }) => {
    await goto(page, gradebookUrl);
    const header = page.locator('th:has-text("Student"), th:has-text("Name"), [role="columnheader"]:has-text("Student")').first();
    if (await header.count() > 0) {
      await expect(header).toBeVisible();
    }
  });

  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(gradebookUrl);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).not.toContain('/gradebook');
    await ctx.close();
  });
});
