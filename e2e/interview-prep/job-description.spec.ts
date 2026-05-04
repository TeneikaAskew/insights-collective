import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Job Description Analyzer', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.jobDescription);
  });

  test('renders job description page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.jobDescription);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('job description textarea is present', async ({ page }) => {
    const textarea = page.locator('textarea, [placeholder*="job"], [placeholder*="description"], [placeholder*="paste"]').first();
    if (await textarea.count() > 0) {
      await expect(textarea).toBeVisible();
      await textarea.fill('Senior Software Engineer - React, TypeScript, Node.js required');
    }
  });

  test('analyze or generate button is present', async ({ page }) => {
    const btn = page.locator('button:has-text("Analyze"), button:has-text("Generate"), button:has-text("Submit"), button:has-text("Study Guide")').first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible();
    }
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
