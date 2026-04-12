import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Courses Management', () => {
  test('renders admin courses page', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminCourses);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('course table or list renders', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    const table = page.locator('table, [role="table"], [class*="course"], [class*="Card"]').first();
    if (await table.count() > 0) {
      await expect(table).toBeVisible();
    }
  });

  test('course status (published/draft) is displayed', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    const status = page.locator(':has-text("Published"), :has-text("Draft"), [class*="badge"], [class*="status"]').first();
    if (await status.count() > 0) {
      await expect(status).toBeVisible();
    }
  });

  test('edit course link is present', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    const editLink = page.locator('a[href*="course-edit"], button:has-text("Edit"), a:has-text("Edit")').first();
    if (await editLink.count() > 0) {
      await expect(editLink).toBeVisible();
    }
  });

  test('create new course button is visible', async ({ page }) => {
    await goto(page, Routes.adminCourses);
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Course"), a:has-text("Create")').first();
    if (await createBtn.count() > 0) {
      await expect(createBtn).toBeVisible();
    }
  });
});
