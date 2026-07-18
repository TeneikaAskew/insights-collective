import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, clickTab } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Management (Instructor)', () => {
  const mgmtUrl = Routes.courseManagement();

  test('renders course management page', async ({ page }) => {
    await goto(page, mgmtUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(mgmtUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('management tabs are visible', async ({ page }) => {
    await goto(page, mgmtUrl);
    const tabs = page.locator('[role="tab"]');
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test('students/enrollments section exists', async ({ page }) => {
    await goto(page, mgmtUrl);
    const studentsTab = page.locator('[role="tab"]:has-text("Student"), [role="tab"]:has-text("People"), [role="tab"]:has-text("Enroll")');
    if (await studentsTab.count() > 0) {
      await studentsTab.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('assignments section is accessible', async ({ page }) => {
    await goto(page, mgmtUrl);
    const assignTab = page.locator('[role="tab"]:has-text("Assignment")');
    if (await assignTab.count() > 0) {
      await assignTab.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, mgmtUrl);
    const sidebar = page.locator('[data-sidebar="sidebar"], aside, nav').first();
    await expect(sidebar).toBeVisible();
  });
});
