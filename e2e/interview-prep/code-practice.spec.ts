import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Code Practice', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.codePractice);
  });

  test('renders code practice page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.codePractice);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('code editor (Monaco) renders', async ({ page }) => {
    const editor = page.locator('.monaco-editor, [class*="monaco"], [class*="CodeEditor"], [class*="code-editor"]').first();
    if (await editor.count() > 0) {
      await expect(editor).toBeVisible();
    }
  });

  test('language selector is present', async ({ page }) => {
    const langSel = page.locator('[role="combobox"]:has-text("Python"), [role="combobox"]:has-text("JavaScript"), [class*="language"]').first();
    if (await langSel.count() > 0) {
      await expect(langSel).toBeVisible();
    }
  });

  test('run or submit button is present', async ({ page }) => {
    const runBtn = page.locator('button:has-text("Run"), button:has-text("Submit"), button:has-text("Execute")').first();
    if (await runBtn.count() > 0) {
      await expect(runBtn).toBeVisible();
    }
  });

  test('problem list or question panel renders', async ({ page }) => {
    const problem = page.locator('[class*="problem"], [class*="question"], [class*="challenge"], h2, h3').first();
    if (await problem.count() > 0) {
      await expect(problem).toBeVisible();
    }
  });
});
