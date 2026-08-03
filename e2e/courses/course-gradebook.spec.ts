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

  test('gradebook grid renders with students and gradable items', async ({ page }) => {
    await goto(page, gradebookUrl);
    // The old locator's [class*="gradebook"] alternative matches the page
    // wrapper, so it could not tell a rendered grid from a shell that failed to
    // load one. Columns and rows are what a gradebook IS.
    await expect(page.locator('th').filter({ hasText: 'Student' }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Total' }).first()).toBeVisible();
    expect(await page.locator('tbody tr').filter({ visible: true }).count()).toBeGreaterThan(0);
  });

  test('every gradable item gets a column', async ({ page }) => {
    await goto(page, gradebookUrl);
    // Student + at least one assignment + Total. A gradebook that lost its
    // items would still have kept the two fixed columns, so the floor is what
    // makes this an assertion about the course's content.
    // Wait for a header BEFORE counting: count() resolves immediately and does
    // not retry, so counting first raced the table's render and read 0 while
    // the sibling test above passed on toBeVisible()'s polling.
    await expect(
      page.locator('th').filter({ hasText: 'Submission Formats Exercise' }).first(),
    ).toBeVisible();
    const headers = page.locator('th').filter({ visible: true });
    expect(await headers.count()).toBeGreaterThan(2);
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
