import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Mock Interviews', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.mockInterviews);
  });

  test('renders mock interviews page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.mockInterviews);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('mock interview list or schedule button is visible', async ({ page }) => {
    const scheduleBtn = page.locator('button:has-text("Schedule"), button:has-text("Book"), button:has-text("Start Interview")').first();
    const interviewCards = page.locator('[class*="interview"], [class*="Card"], article').first();
    const hasContent = (await scheduleBtn.count()) > 0 || (await interviewCards.count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('heading is present', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
