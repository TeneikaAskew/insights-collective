// ABOUTME: Genuine end-to-end test for the notification center. Signs in as the
// ABOUTME: seeded test member, loads /notifications, and exercises mark-as-read,
// ABOUTME: delete, and tab filtering against real DB state.
import { test, expect } from '@playwright/test';
import { getSupabaseAccessToken } from './_helpers/signIn';

// This spec runs under the chromium-member project, whose storageState is the
// session global-setup already established, so it starts authenticated. Driving
// the real /login form in beforeEach was redundant work that could only add
// failure surface: when that login was slow or failed, the page sat on /login
// and every later locator timed out. Rely on the project session instead.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';


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

  test('Deleting a notification removes it from the list permanently', async ({ page, request }) => {
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const cardSel = '.cursor-pointer:has(button[aria-label="Delete notification"])';
    const initial = await page.locator(cardSel).count();
    expect(
      initial,
      'Seed gap: E2E member has no notifications. Reseed at least one notification row (e.g. announcement fan-out) for the member.',
    ).toBeGreaterThan(0);

    // Identify the deleted row by its primary key, taken from the DELETE the
    // page issues. Text is not a usable identity here — the grading fan-out
    // leaves many notifications with identical title and message (the E2E
    // member has 34 reading "Assignment graded: Python Data Analysis" / "Your
    // submission was graded."), so "no card matches this text" can never hold.
    // Nor is an aggregate count safe: the suite is fully parallel, other
    // journeys write notifications for this same member, the page subscribes to
    // realtime inserts, and its query is capped at 200 rows, so the count can
    // move for reasons unrelated to this delete. The row id is exact.
    const firstCard = page.locator(cardSel).first();

    const [deleteRequest] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === 'DELETE' && /\/rest\/v1\/notifications\?/.test(r.url()),
        { timeout: 10_000 },
      ),
      firstCard.getByRole('button', { name: /delete notification/i }).click(),
    ]);

    // PostgREST encodes the filter as ?id=eq.<uuid>
    const deletedId = new URL(deleteRequest.url()).searchParams.get('id')?.replace(/^eq\./, '');
    expect(deletedId, 'notification id from the DELETE request').toBeTruthy();

    // The delete must have been accepted, not merely attempted.
    const deleteResponse = await deleteRequest.response();
    expect(deleteResponse?.status(), 'DELETE /notifications status').toBeLessThan(300);

    // Reload so the page refetches, then ask the API directly whether that exact
    // row survived. Querying by primary key is immune to parallel inserts and to
    // the page's 200-row cap, and it proves the delete persisted server-side
    // rather than being a UI-only removal.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const jwt = await getSupabaseAccessToken(page);
    expect(jwt, 'member Supabase session token').toBeTruthy();

    const probe = await request.get(
      `${SUPABASE_URL}/rest/v1/notifications?id=eq.${deletedId}&select=id`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` } },
    );
    expect(probe.status()).toBe(200);
    expect(await probe.json(), 'deleted notification still present after reload').toEqual([]);
  });
});


