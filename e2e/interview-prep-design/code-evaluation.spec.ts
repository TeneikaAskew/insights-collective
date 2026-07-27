// ABOUTME: Authenticated e2e for real code evaluation on Code Practice —
// ABOUTME: signed-in users must get a genuinely evaluated result, not the demo.
//
// Runs only when BOTH are true: a member session exists (E2E_MEMBER_PASSWORD /
// E2E_TEST_PASSWORD supplied to global-setup) and the browser can reach the
// Supabase backend. It self-skips otherwise — sandboxes and offline runs block
// browser egress to supabase.co, where the page correctly falls back to the
// labeled demo (covered by the logged-out spec).
//
// Backend-side invariants (column privileges, forgery rejection, verdicts
// derived from stored execution) are covered by scripts/verify-code-evaluation.mjs.
import { test, expect } from '@playwright/test';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';

test.describe('Code Practice real evaluation (signed in)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/interview-prep/code-practice', { waitUntil: 'domcontentloaded' });
    await page.getByText('Code Challenge Practice').waitFor({ timeout: 15_000 });

    const signedIn = await page.evaluate(() => {
      try {
        return Boolean(JSON.parse(localStorage.getItem('supabase.auth.token') || 'null')?.user);
      } catch {
        return false;
      }
    });
    test.skip(!signedIn, 'no member session — set E2E_MEMBER_PASSWORD or E2E_TEST_PASSWORD');

    // Blocked egress can hang rather than reject, so bound the probe.
    const backendReachable = await page.evaluate(async (url) => {
      try {
        await fetch(`${url}/rest/v1/`, { method: 'GET', signal: AbortSignal.timeout(5000) });
        return true;
      } catch {
        return false;
      }
    }, SUPABASE_URL);
    test.skip(!backendReachable, 'browser cannot reach Supabase — demo fallback is covered elsewhere');
  });

  test('evaluates a correct solution for real, not as a demo', async ({ page }) => {
    await page.getByRole('button', { name: /submit solution/i }).click();
    await expect(page.getByText('Result', { exact: true })).toBeVisible({ timeout: 90_000 });

    // Real evaluation must never be labeled Demo
    await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
    const executed = page.getByText('Executed', { exact: true });
    const aiJudged = page.getByText('AI-judged', { exact: true });
    expect(
      (await executed.count()) + (await aiJudged.count()),
      'result must be labeled Executed or AI-judged',
    ).toBeGreaterThan(0);

    // The tests tile reports a real n/m count, and the review is populated
    await expect(page.getByText(/^\d+\/\d+$/)).toBeVisible();
    await expect(page.getByText('test cases passed')).toBeVisible();
    await expect(page.getByText('Code Review')).toBeVisible();
    await expect(page.getByText('Suggestions')).toBeVisible();

    // Sandbox-executed results carry real runtime/memory; AI-judged ones must
    // not fabricate them.
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if ((await executed.count()) > 0) {
      await expect(page.getByText('runtime')).toBeVisible();
      await expect(page.getByText('memory')).toBeVisible();
    } else {
      await expect(page.getByText('runtime')).toHaveCount(0);
      await expect(page.getByText('memory')).toHaveCount(0);
    }
  });

  test('loads the challenge from the database', async ({ page }) => {
    // A seeded DB challenge supplies starter code with the required signature;
    // Reset must restore it rather than the generic role template.
    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByRole('button', { name: /submit solution/i })).toBeEnabled();
    await expect(page.getByText('Constraints')).toBeVisible();
    await expect(page.getByText(/Hint 1\./)).toBeVisible();
  });
});
