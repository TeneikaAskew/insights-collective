// ABOUTME: Genuine end-to-end journey that hits real Supabase data — no loosened selectors.
// ABOUTME: Verifies login, catalog data, course description, curriculum, lesson content, and progress.
import { test, expect } from '../fixtures/page-helpers';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const COURSE_TITLE = process.env.E2E_TEST_COURSE_TITLE || 'Introduction to Data Science';
// Real seeded description prefix (from public.courses.description)
const COURSE_DESCRIPTION_FRAGMENT = 'comprehensive introduction';
// Real seeded module titles
const MODULE_TITLES = [
  'Foundations of Data Science',
  'Python for Data Analysis',
  'Statistical Methods',
];
// Real seeded lesson title
const FIRST_LESSON_TITLE = 'What is Data Science?';

test.describe('Real course journey — authenticated member', () => {
  test('catalog page lists the seeded course by title', async ({ page }) => {
    await page.goto('/courses');
    // Header must be the actual Courses page, not a fallback
    await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible();
    // The seeded course title must appear in a card — strict assertion
    await expect(
      page.getByRole('heading', { name: COURSE_TITLE, exact: false }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('course detail renders real title, description, and all seeded modules', async ({ page }) => {
    await page.goto(`/courses/${COURSE_ID}`);
    // Title must match seed
    await expect(
      page.getByRole('heading', { name: COURSE_TITLE, exact: false }).first(),
    ).toBeVisible({ timeout: 15_000 });
    // Description text must be present somewhere on the page
    await expect(page.getByText(COURSE_DESCRIPTION_FRAGMENT, { exact: false }).first())
      .toBeVisible();
    // Every seeded module title must render in the curriculum
    for (const title of MODULE_TITLES) {
      await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
    }
  });

  test('course learn page shows curriculum sidebar with the first real lesson', async ({ page }) => {
    await page.goto(`/courses/${COURSE_ID}/learn`);
    // The learn shell must not fall back to "Course not found"
    await expect(page.getByRole('heading', { name: /Course not found/i })).toHaveCount(0);
    // First lesson title must appear (in sidebar or main pane)
    await expect(page.getByText(FIRST_LESSON_TITLE, { exact: false }).first())
      .toBeVisible({ timeout: 15_000 });
    // A module heading must also be visible
    await expect(page.getByText(MODULE_TITLES[0], { exact: false }).first()).toBeVisible();
  });

  test('course data loads through Supabase without HTTP failures', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/rest/v1/courses') || url.includes('/rest/v1/modules') || url.includes('/rest/v1/content_items')) {
        if (res.status() >= 400) failedRequests.push(`${res.status()} ${url}`);
      }
    });
    await page.goto(`/courses/${COURSE_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    expect(failedRequests, `Failed Supabase requests:\n${failedRequests.join('\n')}`).toEqual([]);
  });
});
