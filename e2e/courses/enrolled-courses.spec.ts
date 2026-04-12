import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Enrolled Courses', () => {
  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.enrolledCourses);
    await expectRedirectToLogin(page);
    await ctx.close();
  });

  test('renders enrolled courses page', async ({ page }) => {
    await goto(page, Routes.enrolledCourses);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.enrolledCourses);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('enrolled course cards or empty state renders', async ({ page }) => {
    await goto(page, Routes.enrolledCourses);
    const cards = page.locator('a[href*="/courses/"], [class*="Card"]');
    const empty = page.locator(':has-text("No enrolled"), :has-text("not enrolled"), :has-text("Browse courses")');
    expect((await cards.count()) + (await empty.count())).toBeGreaterThan(0);
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.enrolledCourses);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
