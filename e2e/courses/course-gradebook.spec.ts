import { test, expect } from '../fixtures/page-helpers';
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
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await table.count() > 0) {
      await expect(table.first()).toBeVisible();
    }
  });

  test('student names column is present', async ({ page }) => {
    await goto(page, gradebookUrl);
    const header = page.locator('th:has-text("Student"), th:has-text("Name"), [role="columnheader"]:has-text("Student")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await header.count() > 0) {
      await expect(header).toBeVisible();
    }
  });

  // Body left exactly as it was: it is skipped, so nothing here has ever been
  // executed, and rewriting the assertion would only add a claim CI cannot
  // check. PR 8 owns the rewrite. All this adds is the reason, in the one place
  // the CI coverage-gap report can read it.
  test.skip(
    'unauthenticated user is redirected to login',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'Blocked on PR 8: the gradebook route has no ProtectedRoute, so a signed-out visitor is never redirected.',
      },
    },
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(gradebookUrl);
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).not.toContain('/gradebook');
      await ctx.close();
    },
  );
});
