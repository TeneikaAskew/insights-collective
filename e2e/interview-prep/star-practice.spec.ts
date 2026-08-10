import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('STAR Practice', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.starPractice);
  });

  // THIS PAGE IS GATED, AND ALL THREE GUARDS TESTED THE UNGATED STATE.
  //
  // MEASURED for the shared member: /interview-prep/star-practice renders
  // "No Questions Available — Please analyze a job description first to get
  // personalized STAR questions." and a single "Go Back" button. Zero
  // textareas, zero contenteditable, zero tabs, and no Situation/Task/Action/
  // Result labels anywhere. So the three assertions below all describe the
  // post-analysis screen this account never reaches, and the count-guards made
  // each of them optional. What CAN be asserted is the gate itself.
  test('renders the gate until a job description has been analyzed', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'No Questions Available' })).toBeVisible();
    await expect(
      page.getByText('Please analyze a job description first to get personalized STAR questions.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go Back' })).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.starPractice);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  const NEEDS_ANALYSIS = {
    type: 'skip-reason',
    description:
      'Seed gap: /interview-prep/star-practice is gated on a completed job-description analysis for the acting account, and the shared member has none — the page renders "No Questions Available". Seeding one means driving the JD analyzer (an AI call) or writing whatever it persists; neither is done yet.',
  } as const;

  test.skip(
    'STAR framework sections or labels are visible',
    { annotation: NEEDS_ANALYSIS },
    async ({ page }) => {
      for (const label of ['Situation', 'Task', 'Action', 'Result']) {
        await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      }
    },
  );

  test.skip(
    'practice input areas are visible',
    { annotation: NEEDS_ANALYSIS },
    async ({ page }) => {
      await expect(page.locator('textarea').first()).toBeVisible();
    },
  );

  test.skip(
    'submit or generate button is present',
    { annotation: NEEDS_ANALYSIS },
    async ({ page }) => {
      await expect(page.getByRole('button', { name: /Submit|Generate|Practice/ })).toBeVisible();
    },
  );
});
