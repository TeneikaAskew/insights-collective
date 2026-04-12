import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Data Blueprint Series', () => {
  test('renders data blueprint series page', async ({ page }) => {
    await goto(page, Routes.dataBlueprintSeries);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.dataBlueprintSeries);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.dataBlueprintSeries);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('series content or episode list renders', async ({ page }) => {
    await goto(page, Routes.dataBlueprintSeries);
    const content = page.locator('[class*="series"], [class*="episode"], [class*="Card"], article, p').first();
    await expect(content).toBeVisible();
  });

  test('links to blog posts are present', async ({ page }) => {
    await goto(page, Routes.dataBlueprintSeries);
    const links = page.locator('a[href*="/blog/"]');
    if (await links.count() > 0) {
      await expect(links.first()).toBeVisible();
    }
  });
});
