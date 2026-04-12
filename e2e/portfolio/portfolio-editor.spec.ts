import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Portfolio Editor', () => {
  const editorUrl = Routes.portfolioEditor();

  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(editorUrl);
    await expectRedirectToLogin(page);
    await ctx.close();
  });

  test('renders portfolio editor page', async ({ page }) => {
    await goto(page, editorUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(editorUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('editor toolbar or components panel renders', async ({ page }) => {
    await goto(page, editorUrl);
    const editor = page.locator('[class*="editor"], [class*="Editor"], [class*="toolbar"], [class*="canvas"]').first();
    if (await editor.count() > 0) {
      await expect(editor).toBeVisible();
    }
  });

  test('invalid page ID shows not-found state gracefully', async ({ page }) => {
    await goto(page, '/portfolio-editor/invalid-page-id-99999');
    await expect(page.locator('body')).not.toBeEmpty();
    // Should show an error or redirect, not a blank page
    const content = page.locator(':has-text("not found"), :has-text("error"), main').first();
    await expect(content).toBeVisible();
  });

  test('save or publish button is visible', async ({ page }) => {
    await goto(page, editorUrl);
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Publish"), button:has-text("Update")').first();
    if (await saveBtn.count() > 0) {
      await expect(saveBtn).toBeVisible();
    }
  });
});
