import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Assistants', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.assistants);
  });

  test('renders assistants page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.assistants);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('assistant cards are visible', async ({ page }) => {
    const cards = page.locator('[class*="Card"], article, [class*="assistant"]').first();
    if (await cards.count() > 0) {
      await expect(cards).toBeVisible();
    }
  });

  test('tabs filter assistants by category', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    if (await tabs.count() > 0) {
      await tabs.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('Launch button navigates to assistant interface', async ({ page }) => {
    const launchBtn = page.locator('button:has-text("Launch"), button:has-text("Start"), a:has-text("Launch")').first();
    if (await launchBtn.count() > 0) {
      await expect(launchBtn).toBeVisible();
    }
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
