// ABOUTME: The quiz-taking page for the seeded "Foundations Check-in" fixture.
// ABOUTME: Covers the landing state, starting an attempt, and the question UI.
//
// THE FIXTURE HAD CONSUMED ITSELF, AND THE COUNT-GUARDS REPORTED THAT AS GREEN
//
// Seven guards of the form `if (await x.count() > 0)`. Probing the real page
// showed the quiz rendered its title and NOTHING else — no Start button, no
// options, no submit. The cause was in the data, not the markup: the fixture
// quiz shipped with allowed_attempts = 3, and the member had used all three.
// Every run that clicked Start burned one, so the fixture was designed to stop
// working on the fourth run and did.
//
// seed.sql now raises the limit and asserts it, so the page keeps offering an
// attempt. With that in place every assertion below is unconditional.
//
// One of the old tests could never have passed even on a fresh fixture:
// "Submit Quiz button appears" looked for it on the LANDING page, where it does
// not exist — the quiz has to be started first, and the control only appears
// once you are on a question.

import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

const START_BUTTON = 'button:has-text("Start Quiz")';

test.describe('Quiz Taking', () => {
  const quizUrl = Routes.quizTaking();

  test('renders quiz page', async ({ page }) => {
    await goto(page, quizUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(quizUrl);
    await waitForPageLoad(page);
    // The seeded quiz must actually load. `body` being non-empty was also true
    // of every error page, which is what let the exhausted fixture pass.
    await expect(page.getByRole('heading', { name: 'Foundations Check-in' })).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('quiz title is visible', async ({ page }) => {
    await goto(page, quizUrl);
    // The seeded title, not "the first heading on the page" — the course chrome
    // satisfies that on its own.
    await expect(page.getByRole('heading', { name: 'Foundations Check-in' })).toBeVisible();
  });

  test('Start Quiz button is visible before quiz begins', async ({ page }) => {
    await goto(page, quizUrl);
    await expect(page.locator(START_BUTTON)).toBeVisible();
  });

  test('question navigation renders after starting quiz', async ({ page }) => {
    await goto(page, quizUrl);
    await page.locator(START_BUTTON).click();

    await expect(page.getByText('Question Navigator')).toBeVisible();
    // Two seeded questions, so two numbered jump buttons.
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '2', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  });

  test('multiple choice options render as radio buttons', async ({ page }) => {
    await goto(page, quizUrl);
    await page.locator(START_BUTTON).click();

    // Both seeded questions carry real answers — a question with an empty
    // options array renders "No options configured", which is the dead end
    // seed.sql's answer rows exist to prevent.
    const options = page.locator('[role="radio"], input[type="radio"]');
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBeGreaterThanOrEqual(2);
  });

  // Deliberately no test that SUBMITS. Submitting writes a graded row that
  // quiz-results.spec.ts and quiz-completion-flow.spec.ts then read, and this
  // suite is fullyParallel — a spec here that scored the quiz would be racing
  // the specs that report on it.
});
