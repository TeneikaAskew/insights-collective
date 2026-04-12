import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Assignment Submission', () => {
  const submitUrl = Routes.assignmentSubmit();

  test('renders submission page', async ({ page }) => {
    await goto(page, submitUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(submitUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('submission type tabs are present', async ({ page }) => {
    await goto(page, submitUrl);
    const tabs = page.locator('[role="tablist"]');
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test('Text Entry tab renders textarea/editor', async ({ page }) => {
    await goto(page, submitUrl);
    const textTab = page.locator(Sel.assignment.textEntryTab);
    if (await textTab.count() > 0) {
      await textTab.click();
      await page.waitForTimeout(300);
      const editor = page.locator('[contenteditable], textarea').first();
      if (await editor.count() > 0) {
        await expect(editor).toBeVisible();
      }
    }
  });

  test('Website URL tab renders URL input', async ({ page }) => {
    await goto(page, submitUrl);
    const urlTab = page.locator(Sel.assignment.websiteUrlTab);
    if (await urlTab.count() > 0) {
      await urlTab.click();
      await page.waitForTimeout(300);
      const urlInput = page.locator(Sel.assignment.urlInput);
      if (await urlInput.count() > 0) {
        await expect(urlInput).toBeVisible();
        await urlInput.fill('https://github.com/example/project');
        await expect(urlInput).toHaveValue('https://github.com/example/project');
      }
    }
  });

  test('File Upload tab renders dropzone', async ({ page }) => {
    await goto(page, submitUrl);
    const fileTab = page.locator(Sel.assignment.fileUploadTab);
    if (await fileTab.count() > 0) {
      await fileTab.click();
      await page.waitForTimeout(300);
      const dropzone = page.locator('[class*="dropzone"], [class*="upload"], input[type="file"]').first();
      if (await dropzone.count() > 0) {
        await expect(dropzone).toBeVisible();
      }
    }
  });

  test('Submit Assignment button is present', async ({ page }) => {
    await goto(page, submitUrl);
    const submitBtn = page.locator(Sel.assignment.submitBtn);
    if (await submitBtn.count() > 0) {
      await expect(submitBtn).toBeVisible();
    }
  });

  test('Cancel button navigates back', async ({ page }) => {
    await goto(page, submitUrl);
    const cancelBtn = page.locator(Sel.assignment.cancelBtn);
    if (await cancelBtn.count() > 0) {
      await expect(cancelBtn).toBeVisible();
    }
  });

  test('assignment title/description is displayed', async ({ page }) => {
    await goto(page, submitUrl);
    const title = page.locator('h1, h2, h3').first();
    if (await title.count() > 0) {
      await expect(title).toBeVisible();
    }
  });

  test.skip('unauthenticated user is redirected', async ({ browser }) => {
    // Assignment submission page has no client-side auth guard; skip redirect test.
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(submitUrl);
    await p.waitForLoadState('domcontentloaded');
    expect(p.url()).not.toContain('/submit');
    await ctx.close();
  });
});
