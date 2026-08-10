// ABOUTME: Genuine end-to-end test for the notification center. Signs in as the
// ABOUTME: seeded test member, loads /notifications, and exercises mark-as-read,
// ABOUTME: delete, and tab filtering against real DB state.
import { test, expect } from '@playwright/test';

// This spec runs under the chromium-member project, whose storageState is the
// session global-setup already established, so it starts authenticated. Driving
// the real /login form in beforeEach was redundant work that could only add
// failure surface: when that login was slow or failed, the page sat on /login
// and every later locator timed out. Rely on the project session instead.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';


test.describe('Notifications center — real flow', () => {
  test('renders header, tabs, and either items or empty state', async ({ page }) => {
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^All/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Unread/ })).toBeVisible();

    // Wait for the fetch to settle: either an item card renders or the "Nothing here" empty state does.
    await expect
      .poll(async () => {
        const empty = await page.getByText(/nothing here/i).isVisible().catch(() => false);
        const cards = await page.locator('[class*="border-l-primary"], .cursor-pointer:has(h4)').count();
        return empty || cards > 0;
      }, { timeout: 10_000 })
      .toBe(true);
  });

  test('Mark all as read clears the unread badge in the DB round-trip', async ({ page }) => {
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const markAllBtn = page.getByRole('button', { name: /mark all as read/i });
    // If the button is enabled, at least one unread exists → clicking must clear the Unread badge.
    if (await markAllBtn.isEnabled().catch(() => false)) {
      await markAllBtn.click();
      // The unread tab badge (a small pill) should disappear; button becomes disabled.
      await expect(markAllBtn).toBeDisabled({ timeout: 5_000 });
      await page.getByRole('tab', { name: /^Unread/ }).click();
      await expect(page.getByText(/nothing here/i)).toBeVisible({ timeout: 5_000 });

      // Reload from server — should still show no unread (persisted, not just local state).
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      await page.getByRole('tab', { name: /^Unread/ }).click();
      await expect(page.getByText(/nothing here/i)).toBeVisible({ timeout: 5_000 });
    } else {
      // No unread — verify the disabled state and Unread tab genuinely empty.
      await expect(markAllBtn).toBeDisabled();
      await page.getByRole('tab', { name: /^Unread/ }).click();
      await expect(page.getByText(/nothing here/i)).toBeVisible();
    }
  });

  test('Deleting a notification removes it from the list permanently', async ({ page }) => {
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const cardSel = '[data-testid="notification-card"]';
    const initial = await page.locator(cardSel).count();
    expect(
      initial,
      'Seed gap: E2E member has no notifications. Reseed at least one notification row (e.g. announcement fan-out) for the member.',
    ).toBeGreaterThan(0);

    // Identify the row by its notification id, not by title+message.
    // Fan-out notifications repeat verbatim — this account currently holds 36
    // rows reading "Assignment graded: Python Data Analysis / Your submission
    // was graded." — so a title+message fingerprint matched the deleted row's
    // twins and the "it disappeared" poll could never go false. The id is
    // unique by construction.
    const firstCard = page.locator(cardSel).first();
    const targetId = await firstCard.getAttribute('data-notification-id');
    expect(targetId, 'notification card exposes its id').toBeTruthy();
    const target = page.locator(`[data-notification-id="${targetId}"]`);

    // The row leaves the list optimistically, before the DELETE is answered, so
    // the reload below has to be sequenced after the request rather than after
    // the disappearance. page.reload() aborts whatever is still in flight, and
    // over the relay the round trip is slow enough to lose the write: measured,
    // the notification came back on reload and was still in the table
    // afterwards, while the same delete performed as this user in SQL removed a
    // row. The test was asserting a race, not persistence.
    const deleteAccepted = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && r.url().includes('/rest/v1/notifications'),
      { timeout: 10_000 },
    );

    await firstCard.getByRole('button', { name: /delete notification/i }).click();

    // Optimistic removal: that exact row is gone.
    await expect(target).toHaveCount(0, { timeout: 5_000 });

    const response = await deleteAccepted;
    expect(
      response.status(),
      `DELETE /notifications answered ${response.status()}; the row was never removed server-side`,
    ).toBeLessThan(300);

    // Reload → persisted delete: that specific notification stays gone.
    // Checked by id, so a concurrently-arriving notification with the same
    // wording cannot make this pass or fail by accident.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`[data-notification-id="${targetId}"]`)).toHaveCount(0);
  });
});


