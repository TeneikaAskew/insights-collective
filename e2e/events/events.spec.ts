import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Events', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.events);
  });

  test('renders events page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /event/i }).first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.events);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('event cards or list renders', async ({ page }) => {
    const cards = page.locator('[class*="event"], [class*="Card"], article');
    const empty = page.locator(':has-text("No events"), :has-text("upcoming")');
    // Counted in one shot, this raced the events read: it passes alone and fails
    // under the parallel load of a full run, while the sibling test that waits
    // for a Register button on those same cards passes either way. `count()` is
    // a snapshot with no retry of its own, so the wait has to be explicit.
    await expect
      .poll(async () => (await cards.count()) + (await empty.count()), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test('search input is present', async ({ page }) => {
    // By placeholder, NOT Sel.searchInput.first(). There are two search boxes on
    // every signed-in page and the first is the Navbar's "Search entire site…",
    // so the old locator typed into site search and, asserting nothing, passed
    // regardless. Same defect as the one found on /admin/users.
    const searchInput = page.getByPlaceholder('Search events...');
    await expect(searchInput).toBeVisible();
    // The SEEDED event, not one that merely happens to exist in the shared
    // database. seed.sql guarantees "Data Science Career Panel" and nothing
    // else, so filtering to anything else passes only by luck and times out on
    // a fresh database.
    await searchInput.fill('Data Science Career Panel');
    await expect(
      page.getByRole('heading', { name: 'Data Science Career Panel' }),
    ).toBeVisible();
  });

  test('Upcoming / Past tabs are present', async ({ page }) => {
    // The two tabs carry counts, so this asserts the page loaded events rather
    // than that some element with role=tab exists.
    await expect(page.getByRole('tab', { name: /^Upcoming Events \(/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Past Events \(/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Upcoming Events (0)' })).toHaveCount(0);
  });

  test('Register button is visible on event cards', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Register' }).first()).toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
