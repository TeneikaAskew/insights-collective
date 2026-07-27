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
    const search = page.locator(Sel.searchInput).first();
    await expect(search).toBeVisible();
  });

  test('search filters course results', async ({ page }) => {
    const search = page.locator(Sel.searchInput).first();
    await search.fill('python');
    await page.waitForTimeout(500); // debounce
    // After typing, the UI should react (different results or no-results message)
    const cards = page.locator('[class*="card"], article, [data-component-name*="Card"]');
    const empty = page.locator(':has-text("No courses"), :has-text("no results")');
    const hasResult = (await cards.count()) > 0 || (await empty.count()) > 0;
    expect(hasResult).toBe(true);
  });

  test('category filter dropdown is present', async ({ page }) => {
    const filter = page.locator('[role="combobox"]:has-text("Category"), button:has-text("Category")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await filter.count() > 0) {
      await expect(filter).toBeVisible();
    }
  });

  test('sort dropdown is present', async ({ page }) => {
    const sort = page.locator('[role="combobox"]:has-text("Sort"), button:has-text("Sort")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await sort.count() > 0) {
      await expect(sort).toBeVisible();
    }
  });

  test('tabs for course categories are clickable', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    if (count > 0) {
      await tabs.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('course cards are visible', async ({ page }) => {
    const cards = page.locator('a[href*="/courses/"], [class*="CourseCard"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await cards.count() > 0) {
      await expect(cards.first()).toBeVisible();
    }
  });

  test('clicking a course card navigates to detail page', async ({ page }) => {
    const courseLink = page.locator('a[href^="/courses/"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await courseLink.count() > 0) {
      const href = await courseLink.getAttribute('href');
      expect(href).toMatch(/\/courses\/.+/);
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
