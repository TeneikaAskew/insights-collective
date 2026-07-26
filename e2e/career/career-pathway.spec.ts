import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

// The career agent and career pathway are one page: the coach conversation on
// the left, the report canvas on the right, the action plan below.
//
// Reduced motion is emulated throughout. useCoachChat honors it by skipping the
// per-character typewriter while keeping the read/think pacing — so the coach
// still behaves like the real thing, but messages land in hundreds of
// milliseconds instead of seconds. That makes these tests deterministic AND
// exercises the accessibility path.
test.describe('Career Pathway (merged studio page)', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await goto(page, Routes.careerPathway);
  });

  test('renders the coach panel and report canvas side by side', async ({ page }) => {
    await expect(page.getByTestId('career-pathway-page')).toBeVisible();
    await expect(page.getByTestId('coach-panel')).toBeVisible();
    await expect(page.getByTestId('report-canvas')).toBeVisible();
    // The canvas always renders six slots — ghost placeholders before a report
    // exists, live cards after.
    const ghosts = await page.getByTestId('canvas-ghost').count();
    const cards = await page.getByTestId('canvas-card').count();
    expect(ghosts + cards).toBe(6);
  });

  test('coach greets the user and the acts stepper is present', async ({ page }) => {
    await expect(page.getByTestId('acts-stepper').first()).toBeVisible();
    // Either the intro (new/mid conversation) or the welcome-back line.
    await expect(page.getByTestId('coach-message').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('text=Maya').first()).toBeVisible();
  });

  test('spinner resolves and the page heading is visible', async ({ page }) => {
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });

  test('a finished pathway shows its report and the action plan section', async ({ page }) => {
    const savebar = page.getByTestId('pathway-savebar');
    const isFinished = await savebar.isVisible().catch(() => false);
    test.skip(!isFinished, 'This account has no completed pathway yet');

    // A finished pathway means real cards, not ghosts, and the plan below.
    await expect(page.getByTestId('canvas-card').first()).toBeVisible();
    await expect(page.getByTestId('action-plan-section')).toBeVisible();
    await expect(savebar).toContainText('Your pathway is ready');
  });
});

// "Start over" gives a deterministic entry point regardless of what the account
// answered before: it soft-resets answers (is_reset) and replays the intro.
test.describe('Career Pathway conversation', () => {
  test('start over replays the intro and accepts a quick reply', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await goto(page, Routes.careerPathway);

    await page.getByTestId('start-over').click();

    // Intro plays, then the first question with its quick replies.
    const quickReplies = page.getByTestId('quick-reply');
    await expect(quickReplies.first()).toBeVisible({ timeout: 30_000 });
    expect(await quickReplies.count()).toBeGreaterThan(1);

    const botMessagesBefore = await page.getByTestId('coach-message').count();
    const chosen = (await quickReplies.first().textContent())?.trim() ?? '';
    await quickReplies.first().click();

    // The answer echoes back as a user message and the coach responds.
    const userMessage = page.locator('[data-testid="coach-message"][data-sender="user"]').first();
    await expect(userMessage).toBeVisible({ timeout: 15_000 });
    if (chosen) await expect(userMessage).toContainText(chosen.slice(0, 30));

    await expect
      .poll(async () => page.getByTestId('coach-message').count(), { timeout: 30_000 })
      .toBeGreaterThan(botMessagesBefore + 1);

    // Quick replies belong to question one only — they clear once answered.
    await expect(quickReplies).toHaveCount(0);
  });

  test('typed answers are accepted once the coach finishes composing', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await goto(page, Routes.careerPathway);

    await page.getByTestId('start-over').click();
    await expect(page.getByTestId('quick-reply').first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('quick-reply').first().click();

    // The composer is disabled while the coach composes and re-enables for the
    // next question — never mid-sentence.
    const input = page.getByTestId('coach-input');
    await expect(input).toBeEnabled({ timeout: 30_000 });

    await input.fill('I want to lead an analytics team.');
    await expect(page.getByTestId('coach-send')).toBeEnabled();
    await page.getByTestId('coach-send').click();

    await expect(
      page.locator('[data-testid="coach-message"][data-sender="user"]').last(),
    ).toContainText('analytics team', { timeout: 15_000 });
    await expect(input).toHaveValue('');
  });
});
