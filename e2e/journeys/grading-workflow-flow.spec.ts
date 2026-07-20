// ABOUTME: Genuine end-to-end test for the instructor grading workflow. Verifies
// ABOUTME: the /manage/assignments dashboard and the SpeedGrader entry point. Skips
// ABOUTME: cleanly (with a loud message, not a silent pass) when instructor creds are absent.
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const INSTRUCTOR_EMAIL = process.env.E2E_INSTRUCTOR_EMAIL;
const INSTRUCTOR_PASSWORD = process.env.E2E_INSTRUCTOR_PASSWORD;
const INSTRUCTOR_COURSE =
  process.env.E2E_INSTRUCTOR_COURSE_ID ?? '660e8400-e29b-41d4-a716-446655440001';

async function signInInstructor(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', INSTRUCTOR_EMAIL!);
  await page.fill('input[type="password"]', INSTRUCTOR_PASSWORD!);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20_000 });
}

test.describe('Instructor grading workflow', () => {
  test.skip(
    !INSTRUCTOR_EMAIL || !INSTRUCTOR_PASSWORD,
    'E2E_INSTRUCTOR_EMAIL / E2E_INSTRUCTOR_PASSWORD not set — cannot verify grading UI end-to-end',
  );

  test.beforeEach(signInInstructor);

  test('/manage/assignments lists real assignments with submission counters', async ({ page }) => {
    await page.goto(`${BASE}/courses/${INSTRUCTOR_COURSE}/manage/assignments`, {
      waitUntil: 'domcontentloaded',
    });

    // Instructor-only page: must NOT render the "instructor access required" alert.
    await expect(page.getByText(/you need instructor access/i)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: /^Assignments$/i })).toBeVisible();

    // The dashboard must render either the empty state or at least one assignment row
    // with a "N submitted" / "N graded" badge pair — the exact counters computed from
    // real assignment_submissions rows.
    await expect
      .poll(async () => {
        const empty = await page
          .getByText(/no assignments have been created/i)
          .isVisible()
          .catch(() => false);
        const submittedBadges = await page.getByText(/\d+ submitted/).count();
        const gradedBadges = await page.getByText(/\d+ graded/).count();
        return empty || (submittedBadges > 0 && gradedBadges > 0);
      }, { timeout: 10_000 })
      .toBe(true);
  });

  test('Grade submissions button links into the SpeedGrader', async ({ page }) => {
    await page.goto(`${BASE}/courses/${INSTRUCTOR_COURSE}/manage/assignments`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');

    const graderLinks = page.getByRole('link', { name: /grade submissions/i });
    const count = await graderLinks.count();
    test.skip(count === 0, 'No gradable assignments in the seeded course');

    const href = await graderLinks.first().getAttribute('href');
    expect(href).toMatch(/\/courses\/.+\/assignments\/.+\/grade$/);

    await graderLinks.first().click();
    await expect(page).toHaveURL(/\/assignments\/.+\/grade$/, { timeout: 15_000 });
    // SpeedGrader must render without kicking us out to a permission gate.
    await expect(page.getByText(/instructor access is required/i)).toHaveCount(0);
  });

  test('per-week quiz results view shows class averages for instructors', async ({ page }) => {
    await page.goto(`${BASE}/courses/${INSTRUCTOR_COURSE}/quiz-results`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: /quiz results by week/i })).toBeVisible();
    // Instructor description differs from the student one.
    await expect(page.getByText(/class scores across every module/i)).toBeVisible();
  });
});
