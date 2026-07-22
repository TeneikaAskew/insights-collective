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

    const deleteBtns = page.getByRole('button', { name: /delete notification/i });
    const count = await deleteBtns.count();
    test.skip(count === 0, 'No notifications available to delete');

    // Scope the assertion to the specific card that owns the delete button we
    // click — matching on the h4 title alone is flaky when other cards share
    // the same title (e.g. announcement fan-out to multiple users/courses).
    const firstCard = page.locator('.cursor-pointer:has(button[aria-label="Delete notification"])').first();
    const initialCount = await page.locator('.cursor-pointer:has(button[aria-label="Delete notification"])').count();
    await firstCard.getByRole('button', { name: /delete notification/i }).click();

    // Optimistic removal: total notification cards should decrease by one.
    await expect
      .poll(async () =>
        page.locator('.cursor-pointer:has(button[aria-label="Delete notification"])').count(),
      { timeout: 3_000 })
      .toBeLessThan(initialCount);

    // Reload → persisted delete: still fewer cards than before.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    const afterReload = await page
      .locator('.cursor-pointer:has(button[aria-label="Delete notification"])')
      .count();
    expect(afterReload).toBeLessThan(initialCount);
  });
});

