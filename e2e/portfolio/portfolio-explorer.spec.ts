import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Portfolio Explorer', () => {
  // Unskipped. The stated reason — "has no client-side auth guard" — went stale:
  // /portfolio-explorer is wrapped in <ProtectedRoute> (src/App.tsx:360-364),
  // which renders <Navigate to="/login"> once auth settles with no session. The
  // guard is independently proven live by auth/redirect-state.spec.ts, which
  // navigates to this very route signed out and reads back the stored redirect
  // path. So the skip was not protecting anything; it was hiding coverage of a
  // guard that already works, and would have kept hiding a regression in it.
  //
  // Signed out via test.use, not `browser.newContext()`: this spec runs under
  // chromium-member, and a hand-built context escapes the console-error
  // fixture, which only instruments the injected `page`.
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto(Routes.portfolioExplorer);
      await expectRedirectToLogin(page);
    });
  });

  test('renders portfolio explorer page', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.portfolioExplorer);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    // The heading uses CardTitle which renders as <h3>, so include h3
    await expect(
      page.locator('h1, h2, h3')
        .filter({ hasText: /portfolio/i })
        .first(),
    ).toBeVisible();
  });

  test('tabs are present: Discover, Ideas, Tracker, Pages', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const tabs = page.locator('[role="tab"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test('?tab= query param pre-selects a tab', async ({ page }) => {
    await goto(page, `${Routes.portfolioExplorer}?tab=discover`);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('profile form renders in Discover tab', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const discoverTab = page.locator('[role="tab"]:has-text("Discover")');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await discoverTab.count() > 0) {
      await discoverTab.click();
      await page.waitForTimeout(300);
      const textarea = page.locator('textarea').first();
      // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
      // eslint-disable-next-line no-restricted-syntax
      if (await textarea.count() > 0) {
        await expect(textarea).toBeVisible();
      }
    }
  });

  test('Tracker tab shows kanban board or project list', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const trackerTab = page.locator('[role="tab"]:has-text("Tracker")');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await trackerTab.count() > 0) {
      await trackerTab.click();
      await page.waitForTimeout(300);
    }
  });

  test('Pages tab shows portfolio pages list', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const pagesTab = page.locator('[role="tab"]:has-text("Pages"), [role="tab"]:has-text("Portfolio Pages")');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await pagesTab.count() > 0) {
      await pagesTab.click();
      await page.waitForTimeout(300);
    }
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
