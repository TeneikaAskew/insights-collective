import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Activity Log', () => {
  test('renders activity log page', async ({ page }) => {
    await goto(page, Routes.adminActivity);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminActivity);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('activity table renders with its columns and rows', async ({ page }) => {
    await goto(page, Routes.adminActivity);
    // Columns by name. The old locator's [class*="activity"] alternative
    // matches the page wrapper, so it could not tell a rendered log from a
    // shell that failed to load one.
    for (const col of ['Event Type', 'Description', 'Severity', 'Time']) {
      await expect(page.locator('th').filter({ hasText: col }).first()).toBeVisible();
    }
    expect(await page.locator('tbody tr').filter({ visible: true }).count()).toBeGreaterThan(0);
  });

  // NEITHER FILTER EXISTS. Measured on the rendered page: 0 input[type="date"],
  // 0 [role="combobox"], and the only button besides the app chrome is "Export".
  // Both tests were named for controls this page has never had, and their
  // count-guards reported that as passing.
  //
  // Skipped with named reasons rather than deleted: filtering an activity log
  // by date and by event type is a reasonable thing to want, and the skips keep
  // the gap in the coverage report where a deletion would erase it.
  test.skip(
    'date filter is present',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'UI gap: /admin/activity renders no date control (0 input[type="date"], 0 [placeholder*="date"], 0 [aria-label*="date"]).',
      },
    },
    async ({ page }) => {
      await goto(page, Routes.adminActivity);
      await expect(page.locator('input[type="date"]').first()).toBeVisible();
    },
  );

  test.skip(
    'event type filter is present',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'UI gap: /admin/activity renders no event-type filter (0 [role="combobox"], 0 select, no Filter/Type button). Only "Export" is offered.',
      },
    },
    async ({ page }) => {
      await goto(page, Routes.adminActivity);
      await expect(page.getByRole('combobox').first()).toBeVisible();
    },
  );

  test('export control is offered', async ({ page }) => {
    await goto(page, Routes.adminActivity);
    // The one action this page actually has, and nothing asserted it before.
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  });
});
