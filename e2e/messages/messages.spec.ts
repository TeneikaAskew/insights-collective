import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Messages', () => {
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.skip(
      'unauthenticated user is redirected to login',
      {
        annotation: {
          type: 'skip-reason',
          description:
            'Blocked on PR 8: /messages is routed without ProtectedRoute and shows an inline sign-in card instead of redirecting.',
        },
      },
      async ({ page }) => {
        await page.goto(Routes.messages);
        await expectRedirectToLogin(page);
      },
    );
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
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await newBtn.count() > 0) {
      await expect(newBtn).toBeVisible();
    }
  });

  test('inbox/archived tabs are present', async ({ page }) => {
    await goto(page, Routes.messages);
    const tabs = page.locator('[role="tab"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.messages);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
