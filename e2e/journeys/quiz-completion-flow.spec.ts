// ABOUTME: Genuine end-to-end test for the per-week quiz results view and the inline quiz player.
// ABOUTME: Signs in as the seeded test member and verifies the correct role-scoped rendering.
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@insightscollective.org';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPass123!';
const ENROLLED_COURSE = process.env.E2E_ENROLLED_COURSE_ID ?? '660e8400-e29b-41d4-a716-446655440001';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20_000 });
}

test.describe('Quiz results view — student perspective', () => {
  test.beforeEach(async ({ page }) => { await signIn(page); });

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
  test.beforeEach(async ({ page }) => { await signIn(page); });

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

    // Player exposes either a Start-quiz control (fresh attempt), a Completed
    // banner (previously submitted), or a question prompt when auto-launched.
    // All three are real, verifiable states.
    await expect
      .poll(async () => {
        const startBtn = await page.getByRole('button', { name: /start quiz|begin quiz/i }).isVisible().catch(() => false);
        const complete = await page.getByText(/completed|your score/i).isVisible().catch(() => false);
        const question = await page.getByText(/question\s*\d+/i).isVisible().catch(() => false);
        return startBtn || complete || question;
      }, { timeout: 10_000 })
      .toBe(true);
  });
});
