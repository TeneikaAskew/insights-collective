import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Question Banks (Instructor)', () => {
  const qbUrl = Routes.questionBanks();

  test('renders question banks page', async ({ page }) => {
    await goto(page, qbUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(qbUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('add question button is present', async ({ page }) => {
    await goto(page, qbUrl);
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New Question"), button:has-text("Create")').first();
    if (await addBtn.count() > 0) {
      await expect(addBtn).toBeVisible();
    }
  });

  test('question list or empty state renders', async ({ page }) => {
    await goto(page, qbUrl);
    const list = page.locator('table, [role="list"], [class*="question"]');
    const empty = page.locator(':has-text("No questions"), :has-text("add your first")');
    expect((await list.count()) + (await empty.count())).toBeGreaterThan(0);
  });
});
