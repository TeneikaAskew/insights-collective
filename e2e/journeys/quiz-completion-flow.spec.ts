// ABOUTME: Genuine end-to-end test for the per-week quiz results view and the inline quiz player.
// ABOUTME: Signs in as the seeded test member and verifies the correct role-scoped rendering.
import { test, expect } from '../fixtures/page-helpers';

// This spec runs under the chromium-member project, whose storageState is the
// session global-setup already established, so it starts authenticated. Driving
// the real /login form in beforeEach was redundant work that could only add
// failure surface: when that login was slow or failed, the page sat on /login
// and every later locator timed out. Rely on the project session instead.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const ENROLLED_COURSE = process.env.E2E_ENROLLED_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';


test.describe('Quiz results view — student perspective', () => {
  test('renders per-week quiz breakdown or a clear empty state', async ({ page }) => {
    await page.goto(`${BASE}/courses/${ENROLLED_COURSE}/quiz-results`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: /quiz results by week/i })).toBeVisible({
      timeout: 15_000,
    });

    // Description text must match student mode ("Your best score...").
    await expect(page.getByText(/your best score for each quiz/i)).toBeVisible();

    // Wait for the async load, then require exactly one of: empty alert OR a module card.
    await expect
      .poll(async () => {
        const empty = await page
          .getByText(/this course has no quizzes yet/i)
          .isVisible()
          .catch(() => false);
        const moduleCards = await page
          .locator('[class*="card"]:has(svg.lucide-graduation-cap)')
          .count();
        return empty || moduleCards > 0;
      }, { timeout: 10_000 })
      .toBe(true);

    // Student view must never expose the class-average / student-list badges.
    await expect(page.getByText(/class avg/i)).toHaveCount(0);
    await expect(page.getByText(/students completed/i)).toHaveCount(0);
  });

  test('back link navigates to the course home', async ({ page }) => {
    await page.goto(`${BASE}/courses/${ENROLLED_COURSE}/quiz-results`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByRole('link', { name: /back to course/i }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${ENROLLED_COURSE}$`));
  });
});

test.describe('Quiz taking — full attempt lifecycle', () => {
  test('opening a quiz page renders the player scaffolding', async ({ page }) => {
    await page.goto(`${BASE}/courses/${ENROLLED_COURSE}/learn`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');

    // A quiz lesson MUST be seeded for the enrolled course; a missing quiz is a
    // seed-data gap, not a valid skip condition. The curriculum rail renders
    // quiz rows as listitems containing a small type badge with the text "Quiz"
    // plus a Start/Resume/Review button.
    const quizRow = page
      .locator('li')
      .filter({ has: page.getByText(/^Quiz$/) })
      .first();
    const quizCount = await quizRow.count();
    expect(
      quizCount,
      'Seed gap: no quiz lessons in the enrolled course. Reseed e2e/fixtures/seed.sql (quizzes/lessons for E2E_TEST_COURSE_ID).',
    ).toBeGreaterThan(0);

    await quizRow.getByRole('button', { name: /start|resume|review/i }).click();

    // This previously polled for a "Start quiz" button, a "Completed" banner or
    // a "Question N" prompt. InlineQuizPlayer renders none of those strings —
    // there is no start control (the first question is shown immediately), the
    // review header reads "Quiz results", and question text is rendered as the
    // question body with no "Question N" label. All three alternatives were
    // unreachable, so the poll could only ever time out.
    //
    // Assert the states the player actually has, by testid so wording changes
    // don't silently break this again.
    const state = page.locator(
      '[data-testid="quiz-player-active"], [data-testid="quiz-player-review"], ' +
      '[data-testid="quiz-player-exhausted"], [data-testid="quiz-player-empty"]',
    );
    await expect(state.first()).toBeVisible({ timeout: 15_000 });

    // The attempt-lookup failure path renders CourseErrorState. That is a real
    // state too, but it is a failure — accepting it would let a broken player
    // pass as "scaffolding rendered".
    await expect(page.getByText(/couldn't load your quiz attempts/i)).toHaveCount(0);
  });
});
