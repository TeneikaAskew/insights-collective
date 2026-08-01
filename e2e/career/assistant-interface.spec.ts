import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';
import { stopAtGuard } from '../helpers/visibility-helpers';

// Same vacancy as assistants.spec.ts: /assistant/:id resolves through the
// /assistants gate, so with the section hidden every test here was satisfied by
// the ComingSoon card — `main` present, no spinners, body not empty, and three
// count-guards matching nothing. Each test now asserts the gate or the content,
// whichever the live configuration makes correct.
test.describe('Assistant Interface', () => {
  const assistantUrl = Routes.assistantInterface();

  test('renders assistant chat interface', async ({ page }) => {
    await goto(page, assistantUrl);
    if (await stopAtGuard(page, assistantUrl)) return;
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(assistantUrl);
    await waitForPageLoad(page);
    // True of the gate and of the page alike.
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('chat message input is present', async ({ page }) => {
    await goto(page, assistantUrl);
    if (await stopAtGuard(page, assistantUrl)) return;
    // Unconditional now: AssistantChatInterface always renders ChatInput
    // (AssistantChatInterface.tsx), so a missing composer is a defect, not an
    // empty data set. The guard could only ever have hidden that.
    await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible();
  });

  test('send button is present', async ({ page }) => {
    await goto(page, assistantUrl);
    if (await stopAtGuard(page, assistantUrl)) return;
    await expect(
      page
        .locator('button[type="submit"], button:has-text("Send"), button[aria-label*="send"]')
        .first(),
    ).toBeVisible();
  });

  test('invalid assistant ID renders error or empty state gracefully', async ({ page }) => {
    await goto(page, '/assistant/non-existent-id-12345');
    if (await stopAtGuard(page, '/assistant/non-existent-id-12345')) return;
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('message history / conversation area renders', async ({ page }) => {
    await goto(page, assistantUrl);
    if (await stopAtGuard(page, assistantUrl)) return;
    await expect(
      page.locator('[class*="message"], [class*="chat"], [class*="conversation"]').first(),
    ).toBeVisible();
  });
});
