// ABOUTME: End-to-end test for the profile "My Certificates" section. Signs in as the
// ABOUTME: seeded member and asserts either the empty state or a certificate row with
// ABOUTME: a working verification link renders — never a silent pass.
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@insightscollective.org';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPass123!';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20_000 });
  // Let any post-login redirect settle before we navigate away.
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function gotoProfile(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  // Guard against post-login navigations landing us on /dashboard instead.
  await page.waitForURL(/\/profile(\?|$|#)/, { timeout: 15_000 }).catch(async () => {
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  });
}

test.describe('Profile — My Certificates', () => {
  test.beforeEach(async ({ page }) => { await signIn(page); });

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
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('my-certificates-card')).toBeVisible({ timeout: 15_000 });

    const rows = page.getByTestId('certificate-row');
    const count = await rows.count();
    test.skip(count === 0, 'Signed-in member has no certificates seeded — cannot exercise verify link');

    const link = rows.first().getByTestId('certificate-verify-link').locator('a');
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/verify-certificate\/.+/);
  });
});
