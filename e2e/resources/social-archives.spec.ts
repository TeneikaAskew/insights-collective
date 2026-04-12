import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Social Archive Pages', () => {
  test('linkedin archive renders filters and refresh affordance', async ({ page }) => {
    await goto(page, Routes.teneikaLinkedIn);
    await expect(page.locator('h1:has-text("LinkedIn Posts")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search posts"]')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh Posts")')).toBeVisible();
  });

  test('tweets archive renders filters and refresh affordance', async ({ page }) => {
    await goto(page, Routes.teneikaTweets);
    await expect(page.locator('h1:has-text("Tweets")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search tweets"]')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh Tweets")')).toBeVisible();
  });
});
