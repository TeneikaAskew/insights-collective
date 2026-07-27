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

    const cardSel = '.cursor-pointer:has(button[aria-label="Delete notification"])';
    const initial = await page.locator(cardSel).count();
    expect(
      initial,
      'Seed gap: E2E member has no notifications. Reseed at least one notification row (e.g. announcement fan-out) for the member.',
    ).toBeGreaterThan(0);

    // A card is identified by title + message, but that pair is NOT unique: the
    // grading fan-out produces many notifications with identical text (the E2E
    // member currently has 34 rows reading "Assignment graded: Python Data
    // Analysis" / "Your submission was graded."). Asserting that *no* card
    // matches the fingerprint after deleting one therefore can never pass while
    // duplicates exist — it fails even though the delete worked. Count the
    // matching cards instead and assert the count drops by exactly one.
    const firstCard = page.locator(cardSel).first();
    const title = (await firstCard.locator('h4').first().textContent())?.trim() ?? '';
    const message = (await firstCard.locator('p').last().textContent())?.trim() ?? '';
    const fingerprint = `${title}::${message}`;

    const countMatching = async () => {
      const cards = page.locator(cardSel);
      const n = await cards.count();
      let hits = 0;
      for (let i = 0; i < n; i++) {
        const t = (await cards.nth(i).locator('h4').first().textContent())?.trim() ?? '';
        const m = (await cards.nth(i).locator('p').last().textContent())?.trim() ?? '';
        if (`${t}::${m}` === fingerprint) hits++;
      }
      return hits;
    };

    const before = await countMatching();
    expect(before).toBeGreaterThan(0);

    await firstCard.getByRole('button', { name: /delete notification/i }).click();

    // Optimistic removal: one fewer card carries this fingerprint.
    await expect.poll(countMatching, { timeout: 3_000 }).toBe(before - 1);

    // Reload → the delete persisted rather than being a UI-only removal.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    expect(await countMatching()).toBe(before - 1);
  });
});


