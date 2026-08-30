// ABOUTME: End-to-end coverage for /courses/:courseId/progress and
// ABOUTME: /courses/:courseId/insights as an enrolled student. Both routes had no
// ABOUTME: spec at all, which is how two 42703 errors on /progress once reached main.
import { test, expect } from '../fixtures/page-helpers';
import { E2E_BASE_URL, FIXTURE_COURSES } from '../fixtures/test-data';

/**
 * These assert *loaded data*, not a page shell. The distinction matters here:
 * both pages render a skeleton first and an error card on failure, so
 * "the heading is present" is true even when every query underneath failed.
 * Each test therefore pins content that can only appear once the Supabase
 * reads resolved — the real course title, the seeded module titles, a
 * computed percentage — and explicitly asserts the error card is absent.
 *
 * Runs under chromium-member: the session comes from storageState, and that
 * account is enrolled in FIXTURE_COURSES.enrolled.
 */
const COURSE = FIXTURE_COURSES.enrolled;

// Seeded published modules for the enrolled course. Rendering all three proves
// modules -> content_items -> content_item_progressions all resolved, which is
// the whole chain useCourseProgress depends on.
const MODULE_TITLES = [
  'Foundations of Data Science',
  'Python for Data Analysis',
  'Statistical Methods',
];

test.describe('Student course progress and insights', () => {
  test('/progress renders real per-module progress, not a shell', async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/courses/${COURSE.id}/progress`, {
      waitUntil: 'domcontentloaded',
    });

    // The page's own error card. CourseProgressOverview renders this instead of
    // the data when any of its three queries reject.
    await expect(page.getByText(/failed to load course progress/i)).toHaveCount(0, {
      timeout: 15_000,
    });

    await expect(page.getByRole('heading', { name: /your progress/i })).toBeVisible();

    // Real course row — proves the courses query resolved.
    await expect(page.getByText(COURSE.title).first()).toBeVisible({ timeout: 15_000 });

    // Computed completion — proves the progressions query resolved and was
    // aggregated, rather than the skeleton still being on screen.
    await expect(page.getByText(/overall progress/i).first()).toBeVisible();
    await expect(page.getByText(/course completion/i).first()).toBeVisible();
    await expect(page.getByText(/^\d{1,3}%$/).first()).toBeVisible();

    // Every seeded module must have a card.
    for (const title of MODULE_TITLES) {
      await expect(page.getByText(title).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test('/insights renders the student their own analytics dashboard', async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/courses/${COURSE.id}/insights`, {
      waitUntil: 'domcontentloaded',
    });

    // Both failure renderings: the error card and the "no stats" alert.
    await expect(page.getByText(/failed to load student insights/i)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByText(/unable to load student insights/i)).toHaveCount(0);

    // A student viewing their own data must not be bounced by the role guard.
    await expect(page.getByText(/don't have permission to view this student/i)).toHaveCount(0);

    await expect(
      page.getByRole('heading', { name: /student performance dashboard/i }),
    ).toBeVisible({ timeout: 15_000 });

    // The four metric cards only render once courseStats is computed.
    for (const metric of [
      /overall progress/i,
      /average grade/i,
      /module completion/i,
      /video progress/i,
    ]) {
      await expect(page.getByText(metric).filter({ visible: true }).first()).toBeVisible();
    }

    // Subtitle carries the resolved course title alongside the student name.
    await expect(page.getByText(COURSE.title).first()).toBeVisible();

    for (const tab of ['Overview', 'Assignments', 'Quizzes', 'Activity']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
  });
});
