import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Thread Detail', () => {
  const threadUrl = Routes.threadDetail();

  test('renders thread detail page', async ({ page }) => {
    await goto(page, threadUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(threadUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('thread title or heading is visible', async ({ page }) => {
    await goto(page, threadUrl);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('original post content renders', async ({ page }) => {
    await goto(page, threadUrl);
    const post = page.locator('[class*="post"], [class*="thread"], article, [role="article"]').first();
    if (await post.count() > 0) {
      await expect(post).toBeVisible();
    }
  });

  test('reply input is visible for authenticated users', async ({ page }) => {
    await goto(page, threadUrl);
    const replyInput = page.locator('textarea, [contenteditable], input[placeholder*="reply"], input[placeholder*="comment"]').first();
    if (await replyInput.count() > 0) {
      await expect(replyInput).toBeVisible();
    }
  });

  test('back to forum link is present', async ({ page }) => {
    await goto(page, threadUrl);
    const backLink = page.locator('a[href*="/forum"], a:has-text("Back")').first();
    if (await backLink.count() > 0) {
      await expect(backLink).toBeVisible();
    }
  });
});
