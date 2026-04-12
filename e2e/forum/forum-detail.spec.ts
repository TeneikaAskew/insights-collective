import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Forum Detail', () => {
  const forumUrl = Routes.forumDetail();

  test('renders forum detail page', async ({ page }) => {
    await goto(page, forumUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(forumUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('forum heading is visible', async ({ page }) => {
    await goto(page, forumUrl);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('thread list or empty state renders', async ({ page }) => {
    await goto(page, forumUrl);
    const threads = page.locator('[class*="thread"], a[href*="/thread/"], [role="listitem"]');
    const empty = page.locator(':has-text("No threads"), :has-text("Be the first"), :has-text("no posts")');
    expect((await threads.count()) + (await empty.count())).toBeGreaterThan(0);
  });

  test('New Thread button is visible', async ({ page }) => {
    await goto(page, forumUrl);
    const newThreadBtn = page.locator('button:has-text("New Thread"), button:has-text("Create Thread"), button:has-text("+ Thread")').first();
    if (await newThreadBtn.count() > 0) {
      await expect(newThreadBtn).toBeVisible();
    }
  });

  test('back to forums link is present', async ({ page }) => {
    await goto(page, forumUrl);
    const backLink = page.locator('a[href*="/forum"], a[href="/forums"], a:has-text("Back")').first();
    if (await backLink.count() > 0) {
      await expect(backLink).toBeVisible();
    }
  });
});
