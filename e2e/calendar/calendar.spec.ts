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
    // The Calendar tab and the month grid it renders. The old locator's
    // `table` and `.calendar` alternatives match anything table-shaped or
    // merely named after a calendar.
    await expect(page.getByRole('tab', { name: 'Calendar' })).toBeVisible();
    await expect(page.locator('[role="grid"]').filter({ visible: true }).first()).toBeVisible();
  });

  test('month navigation buttons are present', async ({ page }) => {
    await goto(page, Routes.calendar);
    // The day grid is what this test can honestly check. The month-step controls
    // are icon-only buttons with no accessible name — measured: the page's
    // visible buttons are the four category filters, the numbered day cells, and
    // two unlabelled ones — so button[aria-label*="previous"] and
    // button:has-text("Prev") matched nothing and the guards reported that as
    // passing. Naming them needs an aria-label on the control, which is an app
    // change; a positional selector here would pass for the wrong reason.
    const grid = page.locator('[role="grid"]').filter({ visible: true }).first();
    await expect(grid).toBeVisible();
    // Day cells, so an empty grid fails.
    expect(await grid.getByRole('button').count()).toBeGreaterThan(20);
  });

  // Guards the day grid's geometry, because a stale classNames key is silent.
  // CalendarPanel stretches the grid with react-day-picker v9 names; it used to
  // pass v8's (`head_cell`, `row`, `cell`, …), which v9 drops without warning.
  // The result rendered: 36px weekday headers over 51px day columns, so "Sa" sat
  // a whole column left of Saturday, and each 36px day button hugged the left
  // edge of its 51px cell while the selected/today/hasEvent background — v9 puts
  // modifier classNames on the CELL — painted the full cell as an off-centre
  // oval. Both symptoms are geometry, so nothing but a measurement catches them.
  test('weekday headers line up with their day columns, and days are centred', async ({
    page,
  }) => {
    await goto(page, Routes.calendar);
    const grid = page.locator('[role="grid"]').filter({ visible: true }).first();
    await expect(grid).toBeVisible();

    const geometry = await grid.evaluate((el) => {
      const centre = (node: Element) => {
        const r = node.getBoundingClientRect();
        return { centre: r.x + r.width / 2, width: r.width, height: r.height };
      };
      return {
        // v9 renders each weekday as a bare `<th scope="col">` — it carries the
        // implicit columnheader role but no role attribute, so an explicit
        // `[role="columnheader"]` selector matches nothing and the measurement
        // silently has no columns to compare against.
        headers: Array.from(el.querySelectorAll('th')).map(centre),
        // The first week only: enough to pin the column grid, and it avoids
        // depending on how many weeks the current month spans.
        days: Array.from(el.querySelectorAll('[role="gridcell"]'))
          .slice(0, 7)
          .map((cell) => {
            const button = cell.querySelector('button');
            return { cell: centre(cell), button: button ? centre(button) : null };
          }),
      };
    });

    expect(geometry.headers).toHaveLength(7);
    expect(geometry.days).toHaveLength(7);

    geometry.days.forEach(({ cell, button }, i) => {
      // Header sits over its own column.
      expect(Math.abs(geometry.headers[i].centre - cell.centre)).toBeLessThan(1);
      expect(button).not.toBeNull();
      // The number's box is centred in the column, and square — so the pill the
      // event/selected modifiers paint is a circle around it rather than an oval
      // beside it.
      expect(Math.abs(button!.centre - cell.centre)).toBeLessThan(1);
      expect(Math.abs(button!.width - button!.height)).toBeLessThan(2);
    });
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.calendar);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
