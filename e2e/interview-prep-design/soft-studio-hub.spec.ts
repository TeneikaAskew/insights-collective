// ABOUTME: E2E coverage of the Soft Studio interview-prep hub (Concept D:
// ABOUTME: stepper-as-navigation). The hub is public, so no auth is required.
//
// Uses the shared console-error fixture. It previously opted out on the grounds
// that logged-out Supabase noise must not fail design tests — but that noise is
// already covered by named suppressions (/auth\/v1\//, AuthApiError, "No session
// found"), and opting out meant these specs saw no console errors at all.
import { test, expect } from '../fixtures/page-helpers';

test.describe('Interview prep hub (Soft Studio, Concept D)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/interview-prep', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Interview Preparation' }).waitFor({ timeout: 15_000 });
  });

  test('applies the Soft Studio theme', async ({ page }) => {
    const wrapper = page.locator('.ss-wash').first();
    await expect(wrapper).toBeVisible();
    const { background, fontFamily } = await wrapper.evaluate((el) => {
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, fontFamily: s.fontFamily };
    });
    expect(background).toBe('rgb(250, 248, 245)'); // plaster #FAF8F5
    expect(fontFamily).toContain('Outfit');
  });

  test('shows the four-step navigation with logged-out states', async ({ page }) => {
    for (const name of ['Analyze the job', 'Practice STAR stories', 'Drill code challenges', 'Book a mock interview']) {
      await expect(page.getByRole('tab', { name: new RegExp(name, 'i') })).toBeVisible();
    }
    await expect(page.getByText('Start here')).toBeVisible();
    await expect(page.getByText('Unlocks after analysis')).toBeVisible();
  });

  test('opens the job-description overview by default (no study guide)', async ({ page }) => {
    await expect(page.getByText('Job Description Analysis')).toBeVisible();
    await expect(page.getByRole('button', { name: /analyze new job description/i })).toBeVisible();
    await expect(page.getByText('Why this matters')).toBeVisible();
    await expect(page.getByText(/73% of successful candidates/)).toBeVisible();
  });

  test('stepper selection swaps the overview and evidence cards', async ({ page }) => {
    await page.getByRole('tab', { name: /drill code challenges/i }).click();
    await expect(page.getByText('Code Challenge Practice')).toBeVisible();
    await expect(page.getByText(/94% of technical roles/)).toBeVisible();

    await page.getByRole('tab', { name: /practice star stories/i }).click();
    await expect(page.getByText('STAR Response Practice')).toBeVisible();
    await expect(page.getByText('Before STAR Practice:')).toBeVisible();
    await expect(page.getByText('After STAR Practice:')).toBeVisible();
    await expect(page.getByRole('button', { name: /analyze job description first/i })).toBeDisabled();

    await page.getByRole('tab', { name: /book a mock interview/i }).click();
    await expect(page.getByText('Mock Interviews', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /schedule mock interview/i })).toBeEnabled();
  });

  test('has no spinners at idle and does not scroll on step change', async ({ page }) => {
    await expect(page.locator('.animate-spin')).toHaveCount(0);
    await page.getByRole('tab', { name: /book a mock interview/i }).click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('legacy /code-practice redirects into the namespace', async ({ page }) => {
    await page.goto('/code-practice', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/interview-prep/code-practice', { timeout: 15_000, waitUntil: 'domcontentloaded' });
  });

  test('legacy /mock-interviews redirects into the namespace', async ({ page }) => {
    await page.goto('/mock-interviews', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/interview-prep/mock-interviews', { timeout: 15_000, waitUntil: 'domcontentloaded' });
  });

  test('job-description page no longer hangs on a spinner when logged out', async ({ page }) => {
    await page.goto('/interview-prep/job-description', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Job Description Analysis').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });
});

test.describe('Job description page (Soft Studio, Split Desk)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/interview-prep/job-description', { waitUntil: 'domcontentloaded' });
    await page.getByText('Job Description Analysis').first().waitFor({ timeout: 15_000 });
  });

  test('applies the Soft Studio theme with the split layout', async ({ page }) => {
    const wrapper = page.locator('.ss-wash').first();
    await expect(wrapper).toBeVisible();
    expect(await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 248, 245)');

    // Input rail and study-guide pane are both present at once
    await expect(page.getByPlaceholder('https://example.com/jobs/123')).toBeVisible();
    await expect(page.getByPlaceholder('Or paste the job description here...')).toBeVisible();
    await expect(page.getByText('Your study guide will appear here')).toBeVisible();
  });

  test('gates the extract and analyze actions on input', async ({ page }) => {
    const extract = page.getByRole('button', { name: /extract/i });
    const analyze = page.getByRole('button', { name: /analyze description/i });
    await expect(extract).toBeDisabled();
    await expect(analyze).toBeDisabled();

    await page.getByPlaceholder('https://example.com/jobs/123').fill('https://example.com/jobs/1');
    await expect(extract).toBeEnabled();
    await page.getByPlaceholder('Or paste the job description here...').fill('Senior ML Engineer role');
    await expect(analyze).toBeEnabled();
  });

  test('back button returns to the interview prep hub', async ({ page }) => {
    await page.getByRole('button', { name: /interview prep/i }).click();
    await page.waitForURL('**/interview-prep', { timeout: 15_000, waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Interview Preparation' })).toBeVisible();
  });
});

test.describe('Code practice page (Soft Studio, Problem Book)', () => {
  // These assert the logged-out simulation — canned "Correct / 3/3", labeled
  // Demo. The file previously ran under chromium-member, where a signed-in
  // visitor happened to get the demo too, because Submit resolved before the
  // database challenge loaded. That bug is fixed, so signed-in visitors now
  // get a real evaluation and these assertions would be testing the wrong
  // mode. Force a signed-out context so they test what they claim to.
  // The signed-in path has its own spec: interview-prep-design/code-evaluation.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/interview-prep/code-practice', { waitUntil: 'domcontentloaded' });
    await page.getByText('Code Challenge Practice').waitFor({ timeout: 15_000 });
  });

  test('applies the Soft Studio theme with the problem-book layout', async ({ page }) => {
    const wrapper = page.locator('.ss-wash').first();
    await expect(wrapper).toBeVisible();
    expect(await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 248, 245)');

    // Original copy is preserved
    await expect(page.getByText('Practice technical coding challenges with real-time feedback.')).toBeVisible();
    await expect(page.getByText('Select your target role:')).toBeVisible();

    // Problem page (left) and editor chrome (right) are both present
    await expect(page.getByText('Two Sum')).toBeVisible();
    await expect(page.getByText('Constraints')).toBeVisible();
    await expect(page.getByText(/Hint 1\./)).toBeVisible();
    await expect(page.getByText('solution.js')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Feedback' })).toBeDisabled();
    await expect(page.getByRole('button', { name: /submit solution/i })).toBeEnabled();
  });

  // Monaco itself loads from a CDN that sandboxed/offline runs can't reach,
  // so this asserts the editor chrome the redesign owns rather than the
  // editor internals. Reset semantics are unit-tested.
  test('reset keeps the editor chrome intact', async ({ page }) => {
    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByText('solution.js')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Code Editor' })).toBeVisible();
    await expect(page.getByRole('button', { name: /submit solution/i })).toBeEnabled();
  });

  test('back button returns to the interview prep hub', async ({ page }) => {
    await page.getByRole('button', { name: /interview prep/i }).click();
    await page.waitForURL('**/interview-prep', { timeout: 15_000, waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Interview Preparation' })).toBeVisible();
  });
});

// The result card has two very different sources. CodePractice submits to
// execute-code/review-code only when there is BOTH a signed-in user and a
// challenge row for the selected role; otherwise it falls back to a canned
// simulation. These assertions describe the simulation — fixed "Correct",
// "3/3", and the "Demo" provenance chip — so they only hold logged out.
//
// They used to run under chromium-member and passed by accident: no
// code_challenges row matched the default "all" role, so even a signed-in
// member fell through to the demo. Once a challenge was seeded for that role
// the member started getting a real evaluation, which is labeled "Executed"
// or "AI-judged" and carries the real test count. Pin the context to
// logged-out so the tests exercise the path they actually describe.
test.describe('Code practice result card (logged out — canned simulation)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/interview-prep/code-practice', { waitUntil: 'domcontentloaded' });
    await page.getByText('Code Challenge Practice').waitFor({ timeout: 15_000 });
  });

  test('submitting swaps the problem page for the result card', async ({ page }) => {
    await page.getByRole('button', { name: /submit solution/i }).click();
    await expect(page.getByText('Result', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Correct', { exact: true })).toBeVisible();
    await expect(page.getByText('3/3')).toBeVisible();
    await expect(page.getByText('Code Review')).toBeVisible();
    await expect(page.getByText('Suggestions')).toBeVisible();

    await page.getByRole('button', { name: /continue editing/i }).click();
    await expect(page.getByText('Constraints')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Feedback' })).toBeEnabled();
  });

  // The simulation must say so, so nobody mistakes canned numbers for a real
  // evaluation. (Signed-in AI-judged and executed modes need a live backend:
  // scripts/verify-code-evaluation.mjs.)
  test('labels the logged-out result as a demo', async ({ page }) => {
    await page.getByRole('button', { name: /submit solution/i }).click();
    await expect(page.getByText('Result', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Demo', { exact: true })).toBeVisible();
    await expect(page.getByText('AI-judged')).toHaveCount(0);
    await expect(page.getByText('Executed')).toHaveCount(0);
  });
});

test.describe('Mock interviews page (Soft Studio, Split Desk)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/interview-prep/mock-interviews', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Mock Interviews' }).waitFor({ timeout: 15_000 });
  });

  test('renders themed with no spinner when logged out', async ({ page }) => {
    const wrapper = page.locator('.ss-wash').first();
    await expect(wrapper).toBeVisible();
    expect(await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 248, 245)');

    await expect(page.getByText('Schedule and participate in mock interviews with peers.')).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);

    for (const name of ['Find Sessions', 'Set Availability', 'Upcoming Sessions', 'Guidelines']) {
      await expect(page.getByRole('tab', { name })).toBeVisible();
    }
    // Split desk: booking rail + partners pane visible together
    await expect(page.getByText('Find Available Partners')).toBeVisible();
    await expect(page.getByText('Please select a date first')).toBeVisible();
  });

  test('guidelines tab keeps the full content', async ({ page }) => {
    await page.getByRole('tab', { name: 'Guidelines' }).click();
    await expect(page.getByText('Interview Guidelines')).toBeVisible();
    await expect(page.getByText('Why Mock Interviews Matter')).toBeVisible();
    await expect(page.getByText('Final Reminders')).toBeVisible();
    await expect(page.getByRole('link', { name: 'StrataScratch' })).toBeVisible();
  });

  test('back button returns to the interview prep hub', async ({ page }) => {
    await page.getByRole('button', { name: /interview prep/i }).click();
    await page.waitForURL('**/interview-prep', { timeout: 15_000, waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Interview Preparation' })).toBeVisible();
  });
});

test.describe('STAR practice page (Soft Studio, Guided Coach)', () => {
  test('renders the themed no-questions state when logged out', async ({ page }) => {
    await page.goto('/interview-prep/star-practice', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('No Questions Available')).toBeVisible({ timeout: 15_000 });

    const wrapper = page.locator('.ss-wash').first();
    await expect(wrapper).toBeVisible();
    expect(await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 248, 245)');
    await expect(page.getByRole('button', { name: /go back/i })).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });
});
