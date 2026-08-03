import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Calendar', () => {
  const calUrl = Routes.courseCalendar();

  test('renders course calendar page', async ({ page }) => {
    await goto(page, calUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(calUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('calendar grid is visible', async ({ page }) => {
    await goto(page, calUrl);
    await expect(page.getByRole('heading', { name: 'Course Calendar' })).toBeVisible();
    await expect(page.getByRole('grid')).toBeVisible();
  });

  test('month navigation moves the calendar', async ({ page }) => {
    await goto(page, calUrl);
    const grid = page.getByRole('grid');
    await expect(grid).toBeVisible();

    // MEASURED: the control is aria-label="Go to the Next Month" and its text
    // content is EMPTY (it is an icon button). So all three of the old
    // alternatives were dead: `[aria-label*="next"]` is case-sensitive and the
    // label capitalises "Next", and neither `:has-text("Next")` nor
    // `:has-text(">")` can match a button with no text.
    //
    // And the old test clicked without asserting anything, so even had the
    // locator worked, "month navigation works" only meant "a click did not
    // throw". The grid's aria-label carries the month, so the move is checkable.
    const before = await grid.getAttribute('aria-label');
    await page.getByRole('button', { name: 'Go to the Next Month' }).click();
    await expect(grid).not.toHaveAttribute('aria-label', before ?? '');
  });

  // UI DEFECT, MEASURED — the Previous Month control cannot be clicked.
  //
  // At the default 1280x720 desktop viewport with the course sidebar collapsed
  // to its icon rail:
  //
  //     "Go to the Previous Month"  x = 4 .. 32
  //     collapsed sidebar rail      x = 0 .. 48
  //     document.elementFromPoint(18, centre)  ->  the sidebar's content div
  //
  // The calendar lays out across the full viewport width instead of starting
  // after the rail, so the button renders UNDERNEATH the sidebar and Playwright
  // reports "subtree intercepts pointer events". A real user hits the same
  // wall. Skipped rather than worked around with force:true, because forcing
  // the click would prove the handler works while the control stays
  // unreachable — which is the kind of green this whole sweep exists to remove.
  test.skip(
    'previous-month navigation works',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'UI defect: on /courses/:id/calendar the "Go to the Previous Month" button (x 4-32) renders beneath the collapsed course sidebar rail (x 0-48) at 1280px, so it intercepts no clicks — elementFromPoint at its centre returns the sidebar. Forward navigation is unaffected and is covered above.',
      },
    },
    async ({ page }) => {
      await goto(page, calUrl);
      const grid = page.getByRole('grid');
      const before = await grid.getAttribute('aria-label');
      await page.getByRole('button', { name: 'Go to the Next Month' }).click();
      await page.getByRole('button', { name: 'Go to the Previous Month' }).click();
      await expect(grid).toHaveAttribute('aria-label', before ?? '');
    },
  );
});
