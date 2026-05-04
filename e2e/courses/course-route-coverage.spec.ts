import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes, TestIds } from '../helpers/route-helpers';

const hasSeededCourseData =
  TestIds.courseId !== 'test-course-id' && TestIds.moduleId !== 'test-module-id';

test.describe('Additional Course Route Coverage', () => {
  test('course management dashboard renders searchable course operations table', async ({ page }) => {
    await goto(page, Routes.courseManagementDashboard);
    await expect(page.locator('h1:has-text("Course Management")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search courses"]')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('legacy singular course route redirects to canonical plural route', async ({ page }) => {
    await page.goto(Routes.legacyCourse());
    await waitForPageLoad(page);
    await expect(page).toHaveURL(new RegExp(`/courses/${TestIds.courseId}`));
  });

  test('module detail route renders content or a graceful invalid-id state', async ({ page }) => {
    await page.goto(Routes.moduleDetail());
    await waitForPageLoad(page);

    if (hasSeededCourseData) {
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await expect(page.locator('body')).toContainText(/Lesson Content|Progress|Module/);
    } else {
      await expect(page.locator('body')).toContainText(/Invalid course or module ID/);
    }
  });

  test('lesson detail invalid route shows not-found guidance instead of a blank page', async ({ page }) => {
    await goto(page, Routes.lessonDetail());
    await expect(page.locator('text=Lesson Not Found')).toBeVisible();
    await expect(page.locator('a:has-text("Back to Module")')).toBeVisible();
  });
});
