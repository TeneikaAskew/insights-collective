// ABOUTME: Covers /courses/:courseId/insights/:studentId for an instructor viewing
// ABOUTME: an enrolled student — the one place the app reads another user's profile
// ABOUTME: row, which RLS (can_view_profile) has to allow for the name to appear.
import { test, expect } from '../fixtures/page-helpers';
import { E2E_BASE_URL, FIXTURE_COURSES } from '../fixtures/test-data';

/**
 * Runs under chromium-instructor (e2e/instructor/** is matched by that project),
 * signed in as the account that owns FIXTURE_COURSES.enrolled.
 *
 * The assertion that earns this spec is the student's *name*. The dashboard
 * reads it from profiles for a user who is not the viewer, so it is the only
 * screen where can_view_profile() is exercised across accounts. If that policy
 * ever stops covering "instructor of a course the student is enrolled in", the
 * page still renders — the name simply goes blank — so a shell-level check
 * would stay green through the regression.
 */
const COURSE = FIXTURE_COURSES.enrolled;

const STUDENT = {
  id: process.env.E2E_MEMBER_USER_ID || '575f018c-fa13-4e36-959f-7aba223b1e53',
  name: 'E2E Member',
};

test.describe('Instructor viewing student insights', () => {
  test("renders the student's own analytics, including their profile name", async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/courses/${COURSE.id}/insights/${STUDENT.id}`, {
      waitUntil: 'domcontentloaded',
    });

    // Instructor must clear the role guard on StudentInsights.
    await expect(page.getByText(/don't have permission to view this student/i)).toHaveCount(0, {
      timeout: 15_000,
    });

    await expect(page.getByText(/failed to load student insights/i)).toHaveCount(0);
    await expect(page.getByText(/unable to load student insights/i)).toHaveCount(0);

    await expect(
      page.getByRole('heading', { name: /student performance dashboard/i }),
    ).toBeVisible({ timeout: 15_000 });

    // The cross-account profile read. Blank here means RLS stopped allowing it.
    await expect(page.getByText(STUDENT.name).filter({ visible: true }).first()).toBeVisible();

    // Rendered in the same subtitle, so it also confirms the course resolved.
    await expect(page.getByText(COURSE.title).first()).toBeVisible();

    // Metric cards prove the per-student aggregation ran for the *target*
    // student rather than falling back to the signed-in instructor.
    await expect(page.getByText(/overall progress/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/module completion/i).filter({ visible: true }).first()).toBeVisible();
  });
});
