// ABOUTME: End-to-end test for the profile "My Certificates" section. Uses the pre-loaded
// ABOUTME: member storageState and asserts either the empty state or a certificate row with
// ABOUTME: a working verification link renders — never a silent pass.
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

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

    const rows = page.getByTestId('certificate-row');
    const count = await rows.count();
    expect(
      count,
      'Seed gap: signed-in E2E member has zero certificates. Reseed a completed course + certificate row for the member in e2e/fixtures/seed.sql.',
    ).toBeGreaterThan(0);

    const link = rows.first().getByTestId('certificate-verify-link').locator('a');
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/verify-certificate\/.+/);
  });
});
