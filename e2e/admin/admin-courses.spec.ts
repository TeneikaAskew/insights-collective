import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Courses Management', () => {
  test('renders admin courses page', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminCourses);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('course table renders with its columns and rows', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    // Columns by name. The old locator's [class*="course"] alternative matches
    // most of this page, so it could not distinguish a rendered table from a
    // shell that failed to load one.
    for (const col of ['Course', 'Instructor', 'Status', 'Enrolled', 'Actions']) {
      await expect(page.locator('th').filter({ hasText: col }).first()).toBeVisible();
    }
    expect(await page.locator('tbody tr').filter({ visible: true }).count()).toBeGreaterThan(0);
  });

  test('course status is displayed for each row', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    await expect(page.locator('th').filter({ hasText: 'Status' }).first()).toBeVisible();
    // The old locator led with `:has-text("Published")`, which with no tag
    // qualifier matches every ancestor up to <html> — so one occurrence of the
    // word anywhere on the page satisfied it. Scoped to the table body instead.
    const statuses = page
      .locator('tbody tr')
      .filter({ visible: true })
      .filter({ hasText: /Published|Draft/ });
    expect(await statuses.count()).toBeGreaterThan(0);
  });

  // The row control is an icon-only button in the Actions column, not a link or
  // a button labeled "Edit" — so `button:has-text("Edit")` matched nothing and
  // the count-guard reported that as a pass. Asserting the column is what can
  // be checked reliably today; targeting the control itself needs a testid on
  // it, which is an app change rather than a test one.
  test('each course row exposes an actions control', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    await expect(page.locator('th').filter({ hasText: 'Actions' }).first()).toBeVisible();
    const firstRow = page.locator('tbody tr').filter({ visible: true }).first();
    expect(await firstRow.getByRole('button').count()).toBeGreaterThan(0);
  });

  test('create new course button is visible', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    await expect(page.getByRole('button', { name: 'New course' })).toBeVisible();
  });
});
