import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Page Visibility', () => {
  test('renders page visibility management page', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminPageVisibility);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('visibility toggles are present per page entry', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    // MEASURED: 42 [role="switch"] controls across the ledger. A lower bound
    // rather than an exact count, deliberately: the number tracks the page
    // manifest and the per-role columns, so pinning it would make this test
    // fail every time a page is added — the fixture-decay trap one layer up.
    // What must hold is that the ledger renders SWITCHES and not a read-only
    // list, which is the thing the guard could not distinguish.
    const toggles = page.getByRole('switch');
    expect(await toggles.count()).toBeGreaterThan(10);
    await expect(toggles.first()).toBeVisible();
  });

  test('page names/list is displayed', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    // MEASURED: this ledger renders no <table>, no [role="list"] and no <ul>,
    // so of the old union only `[class*="page"]` could match — and `.first()`
    // over it resolved to whatever wrapper happened to come first. The rows
    // are what this test is named for, so assert their columns and a page
    // that cannot disappear without the manifest changing.
    for (const column of ['Page', 'Path', 'All users', 'Instructors', 'Admins']) {
      await expect(page.getByText(column, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText('governs /dashboard/*').first()).toBeVisible();
  });

  test('toggling visibility updates state', async ({ page }) => {
    // Stub reads AND writes: this test must never mutate the shared
    // database. A previous version clicked the first live switch — Home's
    // "All users" toggle in the ledger — and left the landing page hidden
    // for every visitor whenever cleanup didn't run.
    let patched: Record<string, unknown> | null = null;
    await page.route('**/rest/v1/page_visibility*', async route => {
      const req = route.request();
      if (req.method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'e2e-row-resume',
              page_path: '/resume',
              page_name: 'Resume Analyzer',
              visible_to_users: true,
              visible_to_instructors: true,
            },
          ]),
        });
      }
      if (req.method() === 'PATCH') {
        patched = req.postDataJSON();
        return route.fulfill({ status: 204, body: '' });
      }
      return route.continue();
    });

    await goto(page, Routes.adminPageVisibility);
    const row = page.getByTestId('visibility-row-/resume');
    const toggle = row.locator('[role="switch"]').first();
    await expect(toggle).toHaveAttribute('data-state', 'checked');
    await toggle.click();
    // Optimistic update flips immediately; the PATCH carried the new flag
    await expect(toggle).toHaveAttribute('data-state', 'unchecked');
    expect(patched).toEqual({ visible_to_users: false });
  });
});
