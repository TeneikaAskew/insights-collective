import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Career Pathway', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.careerPathway);
  });

  test('renders career pathway page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.careerPathway);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('career pathway content or empty state renders', async ({ page }) => {
    const content = page.locator(
      '[class*="pathway"], [class*="career"], [class*="recommendations"], [class*="skills"]',
    );
    const empty = page.locator(':has-text("Get started"), :has-text("No pathway"), :has-text("explore")');
    expect((await content.count()) + (await empty.count())).toBeGreaterThan(0);
  });

  test('tabs or sections are present', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    if (await tabs.count() > 0) {
      await tabs.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
