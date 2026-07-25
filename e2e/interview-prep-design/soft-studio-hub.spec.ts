// ABOUTME: E2E coverage of the Soft Studio interview-prep hub (Concept D:
// ABOUTME: stepper-as-navigation). The hub is public, so no auth is required.
//
// Plain @playwright/test (not the console-error fixture): logged-out Supabase
// noise must not fail design tests.
import { test, expect } from '@playwright/test';

test.describe('Interview prep hub (Soft Studio, Concept D)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/interview-prep', { waitUntil: 'domcontentloaded' });
    await page.getByText('Interview prep, one calm step at a time.').waitFor({ timeout: 15_000 });
  });

  test('applies the Soft Studio theme', async ({ page }) => {
    const wrapper = page.locator('.soft-studio').first();
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
