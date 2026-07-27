// ABOUTME: End-to-end validation of the site messaging feature.
// ABOUTME: Signs in as the seeded test account and exercises inbox load, tabs, and the New Conversation dialog.
import { test, expect } from "@playwright/test";

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

    // Wait for the inbox fetch to resolve (skeleton disappears within 10s).
    await expect
      .poll(
        async () => {
          const emptyVisible = await page.getByText(/no conversations yet/i).isVisible().catch(() => false);
          const rowsCount = await page.locator('[data-conversation-id], a[href^="/messages/"]').count();
          return emptyVisible || rowsCount > 0;
        },
        { timeout: 10000 },
      )
      .toBe(true);
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
