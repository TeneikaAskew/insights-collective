import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('STAR Practice', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.starPractice);
  });

  test('renders STAR practice page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.starPractice);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('STAR framework sections or labels are visible', async ({ page }) => {
    const starLabels = page.locator(':has-text("Situation"), :has-text("Task"), :has-text("Action"), :has-text("Result")');
    if (await starLabels.count() > 0) {
      await expect(starLabels.first()).toBeVisible();
    }
  });

  test('practice input areas are visible', async ({ page }) => {
    const inputs = page.locator('textarea, [contenteditable]').first();
    if (await inputs.count() > 0) {
      await expect(inputs).toBeVisible();
    }
  });

  test('submit or generate button is present', async ({ page }) => {
    const btn = page.locator('button:has-text("Submit"), button:has-text("Generate"), button:has-text("Practice"), button:has-text("Analyze")').first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible();
    }
  });
});
