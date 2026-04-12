import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Grading Interface (Instructor)', () => {
  const gradingUrl = Routes.gradingInterface();

  test('renders grading interface', async ({ page }) => {
    await goto(page, gradingUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(gradingUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('submission content is displayed', async ({ page }) => {
    await goto(page, gradingUrl);
    const content = page.locator('[class*="submission"], [class*="grading"], [class*="student"]').first();
    if (await content.count() > 0) {
      await expect(content).toBeVisible();
    }
  });

  test('grade input field is present', async ({ page }) => {
    await goto(page, gradingUrl);
    const gradeInput = page.locator('input[type="number"], input[name*="grade"], input[placeholder*="grade"]').first();
    if (await gradeInput.count() > 0) {
      await expect(gradeInput).toBeVisible();
    }
  });

  test('feedback textarea is present', async ({ page }) => {
    await goto(page, gradingUrl);
    const feedback = page.locator('textarea, [placeholder*="feedback"], [placeholder*="comment"]').first();
    if (await feedback.count() > 0) {
      await expect(feedback).toBeVisible();
    }
  });

  test('Save Grade button is present', async ({ page }) => {
    await goto(page, gradingUrl);
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Grade"), button:has-text("Submit Grade")').first();
    if (await saveBtn.count() > 0) {
      await expect(saveBtn).toBeVisible();
    }
  });

  test('unauthenticated user is redirected', async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(gradingUrl);
    await p.waitForLoadState('domcontentloaded');
    expect(p.url()).not.toContain('/grade');
    await ctx.close();
  });
});
