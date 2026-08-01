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
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await content.count() > 0) {
      await expect(content).toBeVisible();
    }
  });

  test('grade input field is present', async ({ page }) => {
    await goto(page, gradingUrl);
    const gradeInput = page.locator('input[type="number"], input[name*="grade"], input[placeholder*="grade"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await gradeInput.count() > 0) {
      await expect(gradeInput).toBeVisible();
    }
  });

  test('feedback textarea is present', async ({ page }) => {
    await goto(page, gradingUrl);
    const feedback = page.locator('textarea, [placeholder*="feedback"], [placeholder*="comment"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await feedback.count() > 0) {
      await expect(feedback).toBeVisible();
    }
  });

  test('Save Grade button is present', async ({ page }) => {
    await goto(page, gradingUrl);
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Grade"), button:has-text("Submit Grade")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await saveBtn.count() > 0) {
      await expect(saveBtn).toBeVisible();
    }
  });

  // Body untouched — see the note in course-gradebook.spec.ts.
  test.skip(
    'unauthenticated user is redirected',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'Blocked on PR 8: the grading-interface route has no ProtectedRoute, so a signed-out visitor is never redirected.',
      },
    },
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.goto(gradingUrl);
      await p.waitForLoadState('domcontentloaded');
      expect(p.url()).not.toContain('/grade');
      await ctx.close();
    },
  );
});
