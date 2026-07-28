// ABOUTME: End-to-end validation of the site messaging feature.
// ABOUTME: Signs in as the seeded test account and exercises inbox load, tabs, and the New Conversation dialog.
import { test, expect } from '../fixtures/page-helpers';
import { TEST_USERS } from "../fixtures/test-data";

// This spec runs under the chromium-member project, whose storageState is the
// session global-setup already established, so it starts authenticated. Driving
// the real /login form in beforeEach was redundant work that could only add
// failure surface: when that login was slow or failed, the page sat on /login
// and every later locator timed out. Rely on the project session instead.
const BASE = process.env.E2E_BASE_URL || "http://localhost:8080";

test.describe("Messaging", () => {
  test("inbox loads and shows empty state or conversations", async ({ page }) => {
    await page.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /inbox/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /archived/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /deleted/i })).toBeVisible();

    // Wait for the inbox fetch to resolve into one of its terminal states.
    //
    // Which state is correct depends on data this spec does not control: the
    // acting account has conversations in some environments and none in
    // others, so both the empty state and a list of rows are passes. The old
    // version polled a bare boolean, so any failure surfaced as
    // "Expected: true" with no indication of what the page was showing —
    // stuck on skeletons, showing the error alert, or rendering an empty list.
    // Poll a descriptive state instead, and let the error alert fail loudly.
    const inboxState = async () => {
      const errorAlert = page.getByText(/error loading conversations/i);
      if (await errorAlert.isVisible().catch(() => false)) {
        const detail = await page
          .getByRole('alert')
          .innerText()
          .catch(() => '');
        return `error: ${detail.replace(/\s+/g, ' ').trim().slice(0, 200)}`;
      }
      if (await page.getByText(/no conversations yet/i).isVisible().catch(() => false)) {
        return 'empty';
      }
      // Not the banned guard-around-an-assertion: inboxState is a state
      // classifier whose result is asserted by .poll(...).toMatch(/^(empty|rows)$/)
      // below — a count of 0 yields 'pending', which fails the poll rather
      // than silently skipping a check.
      // eslint-disable-next-line no-restricted-syntax
      if (await page.locator('a[href^="/messages/"]').count()) return 'rows';
      return 'pending';
    };

    await expect
      .poll(inboxState, {
        timeout: 30_000,
        message: 'inbox should settle on the empty state or a list of conversations',
      })
      .toMatch(/^(empty|rows)$/);
  });

  test("archived and deleted tabs load without error", async ({ page }) => {
    await page.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: /archived/i }).click();
    await expect(page.getByRole("tab", { name: /archived/i })).toHaveAttribute("data-state", "active");
    await page.getByRole("tab", { name: /deleted/i }).click();
    await expect(page.getByRole("tab", { name: /deleted/i })).toHaveAttribute("data-state", "active");
  });

  test("new conversation dialog opens and exposes user search", async ({ page }) => {
    await page.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /new conversation/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/start a new conversation/i)).toBeVisible();
    await expect(dialog.getByPlaceholder(/search by name/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /start conversation/i })).toBeDisabled();

    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });
});
