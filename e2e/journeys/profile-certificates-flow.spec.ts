// ABOUTME: End-to-end test for the profile "My Certificates" section. Uses the pre-loaded
// ABOUTME: member storageState and asserts either the empty state or a certificate row with
// ABOUTME: a working verification link renders — never a silent pass.
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

async function gotoProfile(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/profile(\?|$|#)/, { timeout: 15_000 }).catch(async () => {
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  });
}

test.describe('Profile — My Certificates', () => {

  test('renders certificates card with either rows or the empty state', async ({ page }) => {
    await gotoProfile(page);
    const card = page.getByTestId('my-certificates-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(/my certificates/i)).toBeVisible();

    // Loading resolves to exactly one of empty state or list — poll for real DB round-trip.
    await expect
      .poll(async () => {
        const empty = await page.getByTestId('certificates-empty').isVisible().catch(() => false);
        const rows = await page.getByTestId('certificate-row').count();
        return empty || rows > 0;
      }, { timeout: 10_000 })
      .toBe(true);
  });

  test('verification link on a certificate row points to the public verify page', async ({ page }) => {
    await gotoProfile(page);
    await expect(page.getByTestId('my-certificates-card')).toBeVisible({ timeout: 15_000 });

    // Wait for the async certificates query to resolve — the skeleton loader
    // is replaced by either the rows list or the empty-state alert. Without
    // this wait, count() races the fetch and returns 0 before data lands.
    await expect(page.getByTestId('certificates-loading')).toHaveCount(0, { timeout: 15_000 });

    // Match the seeded row by its verification code rather than taking
    // rows.first(). The member accumulates other certificates during a run --
    // certificate-generation and full-completion-sequence each auto-issue one
    // for course ...0001 -- so "the first row" is whichever spec happened to
    // finish first, and asserting against it makes this spec's result depend
    // on unrelated specs' timing. SEEDED_CODE is seeded in e2e/fixtures/seed.sql
    // on course ...0002, which no other spec writes to.
    const SEEDED_CODE = 'E2EMEMBERCERT';

    // Radix Slot forwards data-testid onto the underlying <a>, so the testid
    // IS the anchor rather than a wrapper around one.
    const link = page.locator(
      `[data-testid="certificate-verify-link"][href="/verify-certificate/${SEEDED_CODE}"]`,
    );
    await expect(
      link,
      `Seed gap: the E2E member has no certificate with verification code ${SEEDED_CODE}. ` +
        'Re-apply e2e/fixtures/seed.sql (section 3) -- and if it was moved back onto the ' +
        'primary fixture course, move it off again: the certificate-reset specs delete the ' +
        "member's certificate for that course while this spec is running.",
    ).toHaveCount(1);
  });
});
