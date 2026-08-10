// ABOUTME: End-to-end test for the profile "My Certificates" section. Uses the pre-loaded
// ABOUTME: member storageState and asserts either the empty state or a certificate row with
// ABOUTME: a working verification link renders — never a silent pass.
import { test, expect } from '../fixtures/page-helpers';

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
    // rows.first(), so this assertion names the row it means. The specs that
    // issue and delete certificates now run as a separate account
    // (chromium-member-journeys), so the shared member's list should hold
    // exactly this one row -- the seed asserts that count directly. Matching
    // by code keeps the failure legible if that ever stops being true.
    const SEEDED_CODE = 'E2EMEMBERCERT';

    // Radix Slot forwards data-testid onto the underlying <a>, so the testid
    // IS the anchor rather than a wrapper around one.
    const link = page.locator(
      `[data-testid="certificate-verify-link"][href="/verify-certificate/${SEEDED_CODE}"]`,
    );
    await expect(
      link,
      `Seed gap: the E2E member has no certificate with verification code ${SEEDED_CODE}. ` +
        'Re-apply e2e/fixtures/seed.sql (section 3). If it applied cleanly, check that the ' +
        'certificate-reset specs are still running in the chromium-member-journeys project: ' +
        'as the shared member they delete this row out from under this spec.',
    ).toHaveCount(1);
  });

  test('certificate row keeps its text readable at phone width', async ({ page }) => {
    // The row was `flex flex-wrap` with a `flex-1 min-w-0` text column beside
    // the action buttons. min-w-0 lets a flex item shrink without limit, and
    // wrapping is only a last resort — so instead of dropping the buttons to a
    // second line the browser squeezed the text column to about one character
    // wide. Reported symptom: the course title showed a single letter and the
    // verification code ran down the screen vertically.
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoProfile(page);
    await expect(page.getByTestId('my-certificates-card')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('certificates-loading')).toHaveCount(0, { timeout: 15_000 });

    const row = page.getByTestId('certificate-row').first();
    await expect(row).toBeVisible();

    const rowBox = await row.boundingBox();
    expect(rowBox, 'certificate row has a layout box').toBeTruthy();

    // The verification code is a single unbroken token, so its own width is the
    // most direct read on how much room the text column actually got. One
    // character per line would put it near 10px; the code needs well over half
    // the row.
    const code = row.locator('p.font-mono');
    const codeBox = await code.boundingBox();
    expect(codeBox, 'verification code line has a layout box').toBeTruthy();
    expect(
      codeBox!.width,
      `Verification code line is only ${Math.round(codeBox!.width)}px wide inside a ` +
        `${Math.round(rowBox!.width)}px row — the text column has collapsed again.`,
    ).toBeGreaterThan(rowBox!.width * 0.5);

    // A collapsed column also makes the row grow tall as text wraps per
    // character. The seeded certificate's content is four short lines.
    expect(
      rowBox!.height,
      `Certificate row is ${Math.round(rowBox!.height)}px tall at 390px wide; ` +
        'that is per-character wrapping, not four lines of text.',
    ).toBeLessThan(260);

    // The title must render its whole first word, not a single clipped letter.
    const title = row.locator('h3').first();
    const titleText = (await title.innerText()).trim();
    expect(titleText.length, `Certificate title rendered as "${titleText}"`).toBeGreaterThan(3);

    // Nothing may push the page sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'profile page scrolls horizontally at 390px').toBeLessThanOrEqual(1);
  });
});
