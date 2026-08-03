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

  test('previous-month navigation works', async ({ page }) => {
    await goto(page, calUrl);
    const grid = page.getByRole('grid');
    await expect(grid).toBeVisible();
    const before = await grid.getAttribute('aria-label');

    // This was skipped when written: the Previous arrow rendered at x 4-32,
    // underneath the collapsed course sidebar rail at x 0-48, because
    // react-day-picker v9 moved `nav` out of the caption while the calendar's
    // classNames still positioned the BUTTONS absolutely against a `relative`
    // that was no longer their ancestor — so both arrows resolved against the
    // viewport. Fixed in src/components/ui/calendar.tsx; now measured at
    // x 334 and x 558, inside the calendar, with elementFromPoint returning
    // the button itself.
    await page.getByRole('button', { name: 'Go to the Next Month' }).click();
    await expect(grid).not.toHaveAttribute('aria-label', before ?? '');

    await page.getByRole('button', { name: 'Go to the Previous Month' }).click();
    await expect(grid).toHaveAttribute('aria-label', before ?? '');
  });
});
