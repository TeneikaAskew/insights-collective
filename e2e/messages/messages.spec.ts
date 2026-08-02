// ABOUTME: Messages now live in the Dashboard beside the Calendar, and inside each course.
// ABOUTME: This spec covers where they render and that the old /messages links still land.
import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Messages', () => {
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    // Unlike the old standalone /messages page, which rendered an inline sign-in card,
    // the Messages tab lives on the Dashboard — and the Dashboard already redirects a
    // signed-out visitor to /login, carrying the tab through in `redirect` so they land
    // back on Messages after signing in.
    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto(Routes.messages);
      await expectRedirectToLogin(page);
    });
  });

  test('the Dashboard has a Messages tab next to Calendar', async ({ page }) => {
    await goto(page, '/dashboard');

    await expect(page.getByRole('tab', { name: /calendar/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /messages/i })).toBeVisible();
  });

  test('?tab=messages opens the Messages tab directly', async ({ page }) => {
    await goto(page, Routes.messages);

    await expect(page.getByRole('tab', { name: /messages/i })).toHaveAttribute(
      'data-state',
      'active',
    );
    await expect(page.getByRole('heading', { name: 'Messages', level: 2 })).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.messages);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('inbox/archived/deleted tabs render inside the Messages tab', async ({ page }) => {
    await goto(page, Routes.messages);

    await expect(page.getByRole('tab', { name: /^inbox$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^archived$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^deleted$/i })).toBeVisible();
  });

  test('the conversation list settles into a list or an empty state, never an error', async ({ page }) => {
    await goto(page, Routes.messages);

    // Both outcomes are correct — the acting account has threads in some environments
    // and none in others — but the error alert is never correct, so it fails loudly
    // instead of being folded into a permissive "or".
    const state = async () => {
      if (await page.getByText(/error loading conversations/i).isVisible().catch(() => false)) {
        const detail = await page.getByRole('alert').innerText().catch(() => '');
        return `error: ${detail.replace(/\s+/g, ' ').trim().slice(0, 200)}`;
      }
      if (await page.getByText(/no conversations yet/i).isVisible().catch(() => false)) return 'empty';
      // Not a guard around an assertion: this classifier's result is asserted by the
      // poll below, so zero rows yields 'pending' and fails rather than passing quietly.
      // eslint-disable-next-line no-restricted-syntax
      if (await page.locator('[role="tabpanel"]:visible .cursor-pointer button').count()) return 'rows';
      return 'pending';
    };

    await expect
      .poll(state, {
        timeout: 30_000,
        message: 'the conversation list should settle on the empty state or a list of threads',
      })
      .toMatch(/^(empty|rows)$/);
  });

  test('the legacy /messages URL redirects to the Dashboard tab', async ({ page }) => {
    await page.goto(Routes.messagesLegacy);
    await waitForPageLoad(page);

    await expect(page).toHaveURL(/\/dashboard\?tab=messages/);
  });

  test('a legacy /messages/:id link still opens that thread', async ({ page }) => {
    const conversationId = '11111111-2222-4333-8444-555555555555';
    await page.goto(`/messages/${conversationId}`);
    await waitForPageLoad(page);

    // The thread id survives the redirect — old links people sent each other keep working.
    await expect(page).toHaveURL(new RegExp(`tab=messages&conversation=${conversationId}`));
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.messages);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
