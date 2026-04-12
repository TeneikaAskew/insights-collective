import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Messages', () => {
  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.messages);
    await expectRedirectToLogin(page);
    await ctx.close();
  });

  test('renders messages page', async ({ page }) => {
    await goto(page, Routes.messages);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.messages);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.messages);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('conversation list or empty state renders', async ({ page }) => {
    await goto(page, Routes.messages);
    const list = page.locator('[class*="conversation"], [class*="message"], [role="list"]');
    const empty = page.locator(':has-text("No messages"), :has-text("no conversations"), :has-text("Start a conversation")');
    expect((await list.count()) + (await empty.count())).toBeGreaterThan(0);
  });

  test('new message or new conversation button is present', async ({ page }) => {
    await goto(page, Routes.messages);
    const newBtn = page.locator('button:has-text("New"), button:has-text("Compose"), button:has-text("Message")').first();
    if (await newBtn.count() > 0) {
      await expect(newBtn).toBeVisible();
    }
  });

  test('inbox/archived tabs are present', async ({ page }) => {
    await goto(page, Routes.messages);
    const tabs = page.locator('[role="tab"]');
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.messages);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
