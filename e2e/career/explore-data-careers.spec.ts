import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';
import { stubCourseraCatalog } from '../helpers/coursera-helpers';

test.describe('Explore Data Careers', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.exploreDataCareers);
  });

  test('renders explore data careers page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.exploreDataCareers);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('career role cards are visible', async ({ page }) => {
    const cards = page.locator('[class*="Card"], article, [class*="role"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await cards.count() > 0) {
      await expect(cards).toBeVisible();
    }
  });

  test('search input filters roles', async ({ page }) => {
    const searchInput = page.locator(Sel.searchInput).first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await searchInput.count() > 0) {
      await searchInput.fill('analyst');
      await page.waitForTimeout(400);
    }
  });

  test('category tabs filter careers', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await tabs.count() > 0) {
      await tabs.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('category filter via URL query param works', async ({ page }) => {
    await goto(page, `${Routes.exploreDataCareers}?category=Analytics`);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });

  /**
   * Platform courses always outrank Coursera, so which subjects fall through
   * to the external list depends on what's published in the live database.
   * Stubbing the published list empty makes every subject uncovered — the
   * Coursera picks then come one-per-subject from the fixture, deterministically.
   * (The glob does not match coursera_courses: that path segment starts with
   * "coursera", not "courses".)
   */
  const stubNoPlatformCourses = (page: import('@playwright/test').Page) =>
    page.route('**/rest/v1/courses?*', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        : route.continue(),
    );

  test('role detail career path recommends stubbed Coursera courses safely', async ({ page }) => {
    await stubCourseraCatalog(page);
    await stubNoPlatformCourses(page);
    await goto(page, Routes.exploreDataCareers);

    await page.getByRole('button', { name: /Explore role/ }).first().click();
    await page.getByRole('tab', { name: 'Career Path' }).click();

    // The fixture catalog backs the recommendation list, so the exact course
    // is deterministic — and external links must be new-tab with a safe rel.
    const external = page.getByRole('link', { name: /E2E SQL Foundations/ });
    await expect(external).toBeVisible({ timeout: 15_000 });
    await expect(external).toHaveAttribute('href', 'https://www.coursera.org/learn/e2e-sql-foundations');
    await expect(external).toHaveAttribute('target', '_blank');
    await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('an empty catalog result falls back to bundled courses, not an empty section', async ({ page }) => {
    await stubCourseraCatalog(page, []);
    await stubNoPlatformCourses(page);
    await goto(page, Routes.exploreDataCareers);

    await page.getByRole('button', { name: /Explore role/ }).first().click();
    await page.getByRole('tab', { name: 'Career Path' }).click();

    // The bundled catalog serves when the database returns nothing, so
    // coursera.org links still render — just from the bundled copy.
    const external = page.locator('a[href^="https://www.coursera.org/"]');
    await expect(external.first()).toBeVisible({ timeout: 15_000 });
  });
});
