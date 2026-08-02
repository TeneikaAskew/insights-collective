import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Users Management', () => {
  test('renders user management page', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminUsers);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('users table renders with expected columns', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    // The columns, not "some element matched" — the old locator's third
    // alternative, [class*="user"], matches almost anything on a user page.
    for (const col of ['Name', 'Roles', 'Joined', 'Actions']) {
      await expect(page.locator('th').filter({ hasText: col }).first()).toBeVisible();
    }
    expect(await page.locator('tbody tr').filter({ visible: true }).count()).toBeGreaterThan(0);
  });

  test('search input filters users', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    // By placeholder, NOT the shared search selector's .first(). There are two search boxes on
    // this page and the first one is the Navbar's "Search entire site…" — so the
    // old test typed into the site search and, because it asserted nothing,
    // passed regardless. Measured: filtering via the site search leaves 20 rows,
    // via "Search users…" leaves 1.
    const search = page.getByPlaceholder('Search users...');
    await expect(search).toBeVisible();

    const before = await page.locator('tbody tr').filter({ visible: true }).count();
    // A search nobody can match. The old test typed "test" and asserted
    // nothing, so it passed whether or not the input was wired to anything.
    await search.fill('zzzzzzzzzznotauser');
    await expect
      .poll(() => page.locator('tbody tr').filter({ visible: true }).count())
      .toBeLessThan(before);
  });

  // These are BUTTONS carrying counts ("90 All Users", "6 Instructors"), not
  // [role="tab"] elements — the old locator matched nothing, so the test
  // clicked nothing and asserted nothing.
  test('role filters are present and filter the list', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    for (const name of ['All Users', 'Students', 'Instructors', 'Admins']) {
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    }

    // Admins is the smallest cohort, so filtering to it must shrink the list.
    const before = await page.locator('tbody tr').filter({ visible: true }).count();
    await page.getByRole('button', { name: /Admins/ }).click();
    await expect
      .poll(() => page.locator('tbody tr').filter({ visible: true }).count())
      .toBeLessThan(before);
  });

  // The row control is "Actions", not "Edit" or "Manage" — another locator that
  // matched nothing, wrapped in a guard that reported it as a pass.
  test('row actions menu opens', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    await page.getByRole('button', { name: 'Actions' }).first().click();
    await expect(page.getByRole('menu')).toBeVisible();
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminUsers);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
