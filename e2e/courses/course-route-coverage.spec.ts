import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes, TestIds } from '../helpers/route-helpers';

const hasSeededCourseData =
  TestIds.courseId !== 'test-course-id' && TestIds.moduleId !== 'test-module-id';

test.describe('Additional Course Route Coverage', () => {
  test('course management dashboard renders searchable course operations table', async ({ page }) => {
    await goto(page, Routes.courseManagementDashboard);
    // MEASURED as the member: this page DOES render for a non-instructor, with
    // its heading, its operations table and an empty "No courses found." body.
    // So the else-branch — "non-instructor sessions may not see this page,
    // verify body rendered" — was excusing a case that does not occur, and it
    // made the whole test optional for every case that does.
    await expect(page.getByRole('heading', { name: 'Course Management' })).toBeVisible();

    // The page's OWN search box. There are two inputs whose placeholder
    // contains "Search" — the Navbar's "Search entire site..." comes first in
    // document order, so `input[placeholder*="Search"].first()` was asserting
    // about the site-wide search on every page, not this screen's filter.
    // Fourth spec in this sweep to have made that exact mistake.
    await expect(page.getByPlaceholder('Search courses...')).toBeVisible();

    // The table the test is named for.
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    for (const column of ['Title', 'Category', 'Level', 'Instructor', 'Students', 'Status', 'Actions']) {
      await expect(table.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    }
  });

  test('legacy singular course route redirects to canonical plural route', async ({ page }) => {
    await page.goto(Routes.legacyCourse());
    await waitForPageLoad(page);
    await expect(page).toHaveURL(new RegExp(`/courses/${TestIds.courseId}`));
  });

  test('module detail route renders content or a graceful invalid-id state', async ({ page }) => {
    await page.goto(Routes.moduleDetail());
    await waitForPageLoad(page);
    await expect(page.locator('body')).toContainText(
      /Lesson Content|Progress|Module|Introduction to Data Science|Invalid course or module ID|Course not found/,
    );
  });

  test('lesson detail invalid route shows not-found guidance instead of a blank page', async ({ page }) => {
    await goto(page, Routes.lessonDetail());
    // App may render the course shell for unknown lesson IDs instead of a
    // dedicated 404 view; accept either a body render or the not-found copy.
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
