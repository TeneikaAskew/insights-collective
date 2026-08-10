// ABOUTME: End-to-end cover for the profile's Career Path Quiz Results card and
// ABOUTME: the Retake Quiz button. Asserts against the seeded pair of attempts —
// ABOUTME: a scored one and a newer zero-scored one — so a regression to
// ABOUTME: newest-row-wins shows the 0% cards that were reported in production.
import { test, expect } from '../fixtures/page-helpers';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

test.describe('Profile — Career Path Quiz Results', () => {
  test.beforeEach(async ({ page }) => {
    // The card reads localStorage before it queries, and other specs in this
    // project leave quiz scores behind. Clear it so this measures the database
    // path the seed set up.
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.removeItem('quizScores');
      localStorage.removeItem('quizAnswers');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
  });

  test('shows the scored attempt, not the newer zero-scored one', async ({ page }) => {
    const card = page.locator('#quiz-results');
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Resolve loading into one of its terminal states before asserting.
    await expect
      .poll(
        async () => {
          const cards = await page.getByText(/Match Score:/).count();
          if (cards > 0) return 'results';
          const prompt = await card
            .getByText(/haven't taken the career path quiz yet/i)
            .isVisible()
            .catch(() => false);
          return prompt ? 'prompt' : 'loading';
        },
        { timeout: 20_000 },
      )
      .toBe('results');

    // Seeded raw scores are AI/ML 16, Analytics 20, Data Engineering 17,
    // Business Intelligence 18, and the ceilings are 22 / 23 / 19 / 22.
    await expect(card.getByText('89%')).toBeVisible(); // Data Engineering 17/19
    await expect(card.getByText('87%')).toBeVisible(); // Analytics 20/23

    // The bug this spec exists for: every track reported at 0%.
    await expect(card.getByText('0%')).toHaveCount(0);

    // And nothing may report above the maximum.
    const percentages = await card.getByText(/^\d+%$/).allInnerTexts();
    expect(percentages.length).toBeGreaterThan(0);
    for (const value of percentages) {
      expect(parseInt(value, 10)).toBeLessThanOrEqual(100);
    }
  });

  test('Retake Quiz lands on the quiz, not the dashboard', async ({ page }) => {
    const card = page.locator('#quiz-results');
    await expect(card).toBeVisible({ timeout: 15_000 });

    const retake = card.getByRole('button', { name: /retake quiz/i });
    await expect(retake).toBeVisible({ timeout: 20_000 });
    await retake.click();

    // It used to navigate to '/#quiz-section': an anchor that does not exist,
    // on a route that redirects every signed-in visitor to /dashboard. The
    // button appeared to do nothing at all.
    await expect(page).toHaveURL(/\/career-quiz$/, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/dashboard/);

    // And the quiz itself must be on screen, already started.
    await expect(page.getByText(/Question 1 of \d+/)).toBeVisible({ timeout: 15_000 });
  });

  test('/career-quiz renders the quiz directly for a signed-in member', async ({ page }) => {
    await page.goto(`${BASE}/career-quiz`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/career-quiz$/);
    await expect(page.getByText(/Question 1 of \d+/)).toBeVisible({ timeout: 15_000 });
    // Answering must be possible — the scale options are the control that broke
    // on mobile, so check one is actually clickable here.
    await expect(page.getByRole('radio').first()).toBeVisible();
  });
});
