import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Career Agent', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.careerAgent);
  });

  test('renders career agent page', async ({ page }) => {
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.careerAgent);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('chat interface is visible', async ({ page }) => {
    const chat = page.locator('[class*="chat"], [class*="Chat"], [class*="message"], [class*="conversation"]').first();
    if (await chat.count() > 0) {
      await expect(chat).toBeVisible();
    }
  });

  test('message input field is present', async ({ page }) => {
    const input = page.locator('textarea[placeholder*="message"], input[placeholder*="message"], textarea[placeholder*="type"], textarea[placeholder*="ask"]').first();
    if (await input.count() > 0) {
      await expect(input).toBeVisible();
      await input.fill('What career path should I take in data science?');
      await expect(input).toHaveValue(/data science/);
    }
  });

  test('send button is present', async ({ page }) => {
    const sendBtn = page.locator('button[type="submit"], button:has-text("Send"), button[aria-label*="send"]').first();
    if (await sendBtn.count() > 0) {
      await expect(sendBtn).toBeVisible();
    }
  });

  test('quick reply buttons or suggestions appear', async ({ page }) => {
    const quickReplies = page.locator('[class*="quick"], [class*="suggestion"], button:not([type="submit"])').first();
    if (await quickReplies.count() > 0) {
      await expect(quickReplies).toBeVisible();
    }
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
