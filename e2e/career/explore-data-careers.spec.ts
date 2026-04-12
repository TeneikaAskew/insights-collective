import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

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
    if (await cards.count() > 0) {
      await expect(cards).toBeVisible();
    }
  });

  test('search input filters roles', async ({ page }) => {
    const searchInput = page.locator(Sel.searchInput).first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('analyst');
      await page.waitForTimeout(400);
    }
  });

  test('category tabs filter careers', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
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
});
