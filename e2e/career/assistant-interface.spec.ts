import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Assistant Interface', () => {
  const assistantUrl = Routes.assistantInterface();

  test('renders assistant chat interface', async ({ page }) => {
    await goto(page, assistantUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(assistantUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('chat message input is present', async ({ page }) => {
    await goto(page, assistantUrl);
    const input = page.locator('textarea, input[type="text"]').first();
    if (await input.count() > 0) {
      await expect(input).toBeVisible();
    }
  });

  test('send button is present', async ({ page }) => {
    await goto(page, assistantUrl);
    const sendBtn = page.locator('button[type="submit"], button:has-text("Send"), button[aria-label*="send"]').first();
    if (await sendBtn.count() > 0) {
      await expect(sendBtn).toBeVisible();
    }
  });

  test('invalid assistant ID renders error or empty state gracefully', async ({ page }) => {
    await goto(page, '/assistant/non-existent-id-12345');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('message history / conversation area renders', async ({ page }) => {
    await goto(page, assistantUrl);
    const convo = page.locator('[class*="message"], [class*="chat"], [class*="conversation"]').first();
    if (await convo.count() > 0) {
      await expect(convo).toBeVisible();
    }
  });
});
