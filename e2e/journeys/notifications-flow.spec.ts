// ABOUTME: Genuine end-to-end test for the notification center. Signs in as the
// ABOUTME: seeded test member, loads /notifications, and exercises mark-as-read,
// ABOUTME: delete, and tab filtering against real DB state.
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
}

// Every test here mutates the same member's notification list (mark-all-read,
// delete). Run them one at a time so they don't invalidate each other's
// preconditions when the suite is parallel.
test.describe.configure({ mode: 'serial' });

test.describe('Notifications center — real flow', () => {
  test.beforeEach(async ({ page }) => { await signIn(page); });

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

    const cardSel = '.cursor-pointer:has(button[aria-label="Delete notification"])';
    const initial = await page.locator(cardSel).count();
    expect(
      initial,
      'Seed gap: E2E member has no notifications. Reseed at least one notification row (e.g. announcement fan-out) for the member.',
    ).toBeGreaterThan(0);

    // Identify the card by its row id, not by title+message. Assignment
    // grading fans out one notification per grade, so the member accumulates
    // many rows with byte-identical text ("Assignment graded: …" / "Score:
    // 92.00"); a text fingerprint matches all of them and can never go absent.
    const firstCard = page.locator(cardSel).first();
    const id = await firstCard.getAttribute('data-notification-id');
    expect(id, 'Notification cards must expose data-notification-id').toBeTruthy();
    const deleted = page.locator(`[data-notification-id="${id}"]`);

    // The card disappears optimistically, so "gone from the DOM" says nothing
    // about persistence — reloading on the optimistic state alone cancels the
    // in-flight DELETE and the row comes back. Wait for the request to land.
    const deleteRequest = page.waitForResponse(
      (r) =>
        r.request().method() === 'DELETE' &&
        r.url().includes('/rest/v1/notifications') &&
        r.url().includes(id!),
      { timeout: 15_000 },
    );
    await firstCard.getByRole('button', { name: /delete notification/i }).click();

    // Optimistic removal: that exact notification is gone.
    await expect(deleted).toHaveCount(0, { timeout: 5_000 });

    const deleteRes = await deleteRequest;
    expect(deleteRes.status(), 'DELETE accepted by PostgREST').toBeLessThan(300);

    // Reload → persisted delete: it stays gone.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    // Wait for the list to actually finish rendering — either remaining cards
    // or the empty state — so "count 0" means deleted, not still loading.
    await expect(
      page.locator(cardSel).first().or(page.getByText(/nothing here/i)),
    ).toBeVisible({ timeout: 10_000 });
    await expect(deleted).toHaveCount(0);
  });
});


