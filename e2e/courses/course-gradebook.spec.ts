import { test, expect } from '../fixtures/page-helpers';
import { expectRedirectToLogin, goto, waitForPageLoad } from '../fixtures/page-helpers';
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

  // PR 8 owns the rewrite this comment used to defer, and here it is. The body
  // could not have passed even with the guard in place: it waited for
  // `domcontentloaded` and read the URL once, which fires before React has
  // mounted — measured, the URL was still .../gradebook at that instant.
  // expectRedirectToLogin polls the URL and then the sign-in form.
  //
  // The hand-built context is replaced by a describe-scoped `test.use` so the
  // page stays under the console-error fixture, which instruments only the
  // injected `page`.
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto(gradebookUrl);
      await expectRedirectToLogin(page);
    });
  });
});
