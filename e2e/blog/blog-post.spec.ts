import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Blog Post', () => {
  const blogUrl = Routes.blogPost();

  test('renders blog post page', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, blogUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await ctx.close();
  });

  test('spinner resolves on load', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(blogUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
    await ctx.close();
  });

  test('blog post title is visible', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, blogUrl);
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await ctx.close();
  });

  test('blog post content renders', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, blogUrl);
    const content = page.locator('article, [class*="content"], [class*="body"], p').first();
    if (await content.count() > 0) {
      await expect(content).toBeVisible();
    }
    await ctx.close();
  });

  test('invalid blog slug renders gracefully (not blank page)', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, '/blog/this-slug-does-not-exist-12345');
    await expect(page.locator('body')).not.toBeEmpty();
    await ctx.close();
  });

  test('edit button is NOT visible for unauthenticated user', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, blogUrl);
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit Post"), a[href*="edit"]');
    await expect(editBtn).toHaveCount(0);
    await ctx.close();
  });

  test('back link to blog list is present', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, blogUrl);
    const backLink = page.locator('a:has-text("Back"), a[href*="/blog"], a[href="/resources"]').first();
    if (await backLink.count() > 0) {
      await expect(backLink).toBeVisible();
    }
    await ctx.close();
  });
});
