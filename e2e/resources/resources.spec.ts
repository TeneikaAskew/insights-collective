import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Resources', () => {
  test('renders resources page', async ({ page }) => {
    await goto(page, Routes.resources);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.resources);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.resources);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('resource cards or list renders', async ({ page }) => {
    await goto(page, Routes.resources);
    const content = page.locator('[class*="resource"], [class*="Card"], article, p, ul').first();
    await expect(content).toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.resources);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
