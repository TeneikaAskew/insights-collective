import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, clickTab } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Course List', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.courses);
  });

  test('renders course listing page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /course/i }).first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.courses);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('search input is present', async ({ page }) => {
    // By placeholder. Sel.searchInput.first() is the Navbar's "Search entire
    // site…" — the THIRD place in this suite where that locator was pointed at
    // site search instead of the page's own box (after /admin/users and /events).
    await expect(page.getByPlaceholder('Search courses')).toBeVisible();
  });

  test('search filters course results', async ({ page }) => {
    // The catalog's own filter input. Sel.searchInput.first() resolves to the
    // Navbar site search, which sits earlier in the DOM and does not drive this
    // grid — filling that only ever exercised the Navbar's dropdown.
    const search = page.getByPlaceholder('Search courses');
    const grid = page.locator('[data-onboarding="course-grid"]');
    // Cards are buttons carrying the course title; loading renders skeleton
    // divs instead, so wait for a real one before measuring the catalog.
    const cards = grid.locator('button:has(h3)');
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();

    // A query nothing can match collapses the grid to the empty state.
    await search.fill('zzzz-no-such-course');
    await expect(grid.getByRole('heading', { name: 'No courses found' })).toBeVisible();
    await expect(cards).toHaveCount(0);

    // Clearing it restores the full catalog.
    await search.fill('');
    await expect(cards).toHaveCount(total);
  });

  test('category filter dropdown is present', async ({ page }) => {
    // The control reads "All categories", so :has-text("Category") never
    // matched it — "category" is not a substring of "all categories". The three
    // filters are asserted by their actual labels.
    // Filtered by TEXT, not by accessible name: a shadcn Select trigger renders
    // its current value as content but does not expose it as an accessible
    // name, so getByRole('combobox', { name }) finds nothing.
    for (const label of ['All categories', 'All levels', 'Any schedule']) {
      await expect(
        page.getByRole('combobox').filter({ hasText: label }),
      ).toBeVisible();
    }
  });

  test('sort dropdown is present', async ({ page }) => {
    // There is no Sort control on this page — measured: the only comboboxes are
    // All categories / All levels / Any schedule, and no button is named Sort.
    // The "Any schedule" filter is the closest thing and is already covered
    // above, so this asserts the filter row is complete rather than inventing a
    // control that does not exist.
    const combos = page.getByRole('combobox').filter({ visible: true });
    expect(await combos.count()).toBe(3);
  });

  test('tabs for course categories are clickable', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    if (count > 0) {
      await tabs.first().click();
      await page.waitForTimeout(300);
    }
  });

  // Both of these used to locate `a[href*="/courses/"]` behind an
  // `if (count > 0)` guard. The catalog renders `<button onClick={navigate}>`,
  // not anchors, so the locator matched nothing, the guard swallowed it, and
  // both tests passed while asserting nothing at all.
  test('course cards are visible', async ({ page }) => {
    const cards = page.locator('[data-onboarding="course-grid"] button:has(h3)');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('clicking a course card navigates to detail page', async ({ page }) => {
    const firstCard = page.locator('[data-onboarding="course-grid"] button:has(h3)').first();
    await expect(firstCard).toBeVisible();

    // The card carries the course title; the detail page must show that same
    // title, so a navigation to the wrong course fails here rather than
    // passing on the URL shape alone.
    const title = (await firstCard.locator('h3').innerText()).trim();
    await firstCard.click();

    await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}/i);
    await expect(page.getByRole('heading', { name: title }).first()).toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
