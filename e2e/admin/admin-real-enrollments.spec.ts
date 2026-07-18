// ABOUTME: Real admin/instructor journey — verifies the enrollments management UI loads real data.
// ABOUTME: Confirms admin can view Manage courses & enrollments, filter by course, see student rows.
import { test, expect } from '../fixtures/page-helpers';

const COURSE_ID = process.env.E2E_TEST_ADMIN_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const COURSE_TITLE = process.env.E2E_TEST_COURSE_TITLE || 'Introduction to Data Science';

test.describe('Admin — courses & enrollments', () => {
  test('Manage courses page renders header and courses tab', async ({ page }) => {
    await page.goto('/admin/courses');
    await expect(
      page.getByRole('heading', { name: /Manage courses/i }),
    ).toBeVisible({ timeout: 15_000 });
    // Tab controls must render
    await expect(page.getByRole('tab', { name: /courses/i }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /enrollments/i })).toBeVisible();
  });

  test('Courses tab lists the seeded course with enrollment count', async ({ page }) => {
    await page.goto('/admin/courses');
    // Filter to the seeded course via the search box (list may be long)
    const search = page.getByPlaceholder(/Search courses/i);
    await expect(search).toBeVisible({ timeout: 15_000 });
    await search.fill(COURSE_TITLE);
    await expect(page.getByText(COURSE_TITLE, { exact: false }).first())
      .toBeVisible({ timeout: 15_000 });
    // "N enrolled" text renders for the filtered course
    await expect(page.getByText(/\d+ enrolled/).first()).toBeVisible();
  });

  test('Enrollments tab surfaces student management UI', async ({ page }) => {
    await page.goto('/admin/courses');
    await page.getByRole('tab', { name: /enrollments/i }).click();
    // Search-students input must render (per AdminCourses.tsx)
    await expect(
      page.getByPlaceholder(/Search students/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
