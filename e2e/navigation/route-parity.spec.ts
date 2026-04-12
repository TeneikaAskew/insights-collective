import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Additional Route Coverage', () => {
  test('user dashboard renders roadmap and next steps content', async ({ page }) => {
    await goto(page, Routes.userDashboard);
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('text=Roadmap Timeline')).toBeVisible();
    await expect(page.locator('text=Next Steps')).toBeVisible();
  });

  test('legacy course list alias renders browse controls', async ({ page }) => {
    await goto(page, Routes.legacyCourseList);
    await expect(page.locator(Sel.searchInput).first()).toBeVisible();
    await expect(page.locator('text=Courses').first()).toBeVisible();
  });

  test('forums alias redirects to dashboard', async ({ page }) => {
    await page.goto(Routes.forums);
    // /forums redirects to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('assistant-interface legacy route renders the default assistant shell', async ({ page }) => {
    await goto(page, Routes.assistantInterfaceLegacy);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await expect(
      page.locator('textarea, input[placeholder*="message"], input[placeholder*="question"], [contenteditable="true"]').first(),
    ).toBeVisible();
  });

  test('unknown route renders not-found page with recovery link', async ({ page }) => {
    await goto(page, Routes.notFound);
    await expect(page.locator('h1:has-text("404")')).toBeVisible();
    await expect(page.locator('text=Oops! Page not found')).toBeVisible();
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });
});
