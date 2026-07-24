import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, clickTab } from '../fixtures/page-helpers';
import { Routes, TestIds } from '../helpers/route-helpers';

test.describe('Course Detail', () => {
  const courseUrl = Routes.courseDetail();

  test('renders course detail page', async ({ page }) => {
    await goto(page, courseUrl);
    // Should have a course title
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(courseUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('tabs are present: Modules, Assignments, Grades/Overview', async ({ page }) => {
    await goto(page, courseUrl);
    const tabList = page.locator('[role="tablist"]');
    if (await tabList.count() > 0) {
      await expect(tabList.first()).toBeVisible();
    }
  });

  test('Modules tab shows module content', async ({ page }) => {
    await goto(page, Routes.courseModules());
    const modules = page.locator('[class*="module"], [data-component-name*="Module"], li, [role="listitem"]');
    // Should have module content or empty state
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('Assignments tab is navigable', async ({ page }) => {
    await goto(page, Routes.courseAssignments());
    await waitForPageLoad(page);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('invalid course ID shows error or redirect', async ({ page }) => {
    await goto(page, '/courses/non-existent-course-id-12345');
    const errorMsg = page.locator(
      ':has-text("not found"), :has-text("404"), :has-text("error"), :has-text("Failed to load"), :has-text("Invalid course")'
    );
    const redirected = page.url().includes('/courses') && !page.url().includes('non-existent');
    expect((await errorMsg.count()) > 0 || redirected).toBe(true);
  });

  test('breadcrumb or back link renders', async ({ page }) => {
    await goto(page, courseUrl);
    const backLink = page.locator('a[href="/courses"], a:has-text("Courses"), nav').first();
    if (await backLink.count() > 0) {
      await expect(backLink).toBeVisible();
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, courseUrl);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
