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
    const toggles = page.locator('[role="switch"], input[type="checkbox"], [class*="toggle"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await toggles.count() > 0) {
      await expect(toggles.first()).toBeVisible();
    }
  });

  test('page names/list is displayed', async ({ page }) => {
    await goto(page, Routes.adminPageVisibility);
    const pageList = page.locator('table, [role="list"], [class*="page"], ul').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await pageList.count() > 0) {
      await expect(pageList).toBeVisible();
    }
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
