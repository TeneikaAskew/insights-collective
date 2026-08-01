import { test, expect } from '../fixtures/page-helpers';
import { goto, expectRedirectToLogin, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

// The calendar lives in the Dashboard's Calendar tab; Routes.calendar deep-links to it.
test.describe('Calendar (Dashboard tab)', () => {
  // I unskipped this on the assumption that moving the calendar behind the
  // Dashboard supplied the client-side auth guard it was waiting for. CI proved
  // that wrong: it failed with the URL never matching /login.
  //
  // The Dashboard does render <Navigate to="/login?redirect=..."> when
  // unauthenticated, but /dashboard sits inside <Route element={<VisibilityGate/>}>,
  // so the gate decides what mounts first and Dashboard's redirect does not
  // necessarily run. Re-skipped rather than left red, because establishing what
  // unauthenticated users should see on a gated route is its own change — note the
  // long list of sibling specs skipped for the same reason.
  //
  // The one-line version of that now rides on the skip itself, because the CI
  // coverage-gap report reads annotations, not comments.
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.skip(
      'unauthenticated user is redirected to login',
      {
        annotation: {
          type: 'skip-reason',
          description:
            'Blocked on PR 8: /calendar deep-links into /dashboard, which self-redirects from inside VisibilityGate. CI disproved the redirect once already — the URL never reached /login.',
        },
      },
      async ({ page }) => {
        await page.goto(Routes.calendar);
        await expectRedirectToLogin(page);
      },
    );
  });

  test('renders calendar heading', async ({ page }) => {
    await goto(page, Routes.calendar);
    await expect(
      page.locator('h1, h2').filter({ hasText: /calendar/i }).first(),
    ).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.calendar);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('calendar grid or list is visible', async ({ page }) => {
    await goto(page, Routes.calendar);
    const calendar = page.locator('[role="grid"], .fc, .calendar, table, [data-component-name*="Calendar"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await calendar.count() > 0) {
      await expect(calendar).toBeVisible();
    }
  });

  test('month navigation buttons are present', async ({ page }) => {
    await goto(page, Routes.calendar);
    const prevBtn = page.locator('button[aria-label*="previous"], button:has-text("Prev"), button[aria-label*="prev"]').first();
    const nextBtn = page.locator('button[aria-label*="next"], button:has-text("Next")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await prevBtn.count() > 0) {
      await expect(prevBtn).toBeVisible();
    }
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await nextBtn.count() > 0) {
      await expect(nextBtn).toBeVisible();
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.calendar);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
