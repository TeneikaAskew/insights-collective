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

  // The four tabs are numbered and named for what the user does, not for the
  // nouns the old test used: "1 Discover you", "2 Project ideas",
  // "3 Your projects", "4 Your portfolio page". So the old locators
  // :has-text("Tracker") and :has-text("Pages") matched NOTHING — two tests
  // that clicked nothing and asserted nothing. ("Pages" plural never appears;
  // the tab is "Your portfolio page".)
  const TABS = ['Discover you', 'Project ideas', 'Your projects', 'Your portfolio page'];

  test('all four workflow tabs are present', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    for (const name of TABS) {
      await expect(page.getByRole('tab', { name: new RegExp(name) })).toBeVisible();
    }
  });

  test('?tab= query param pre-selects a tab', async ({ page }) => {
    await goto(page, `${Routes.portfolioExplorer}?tab=discover`);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('profile form renders in the Discover tab', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    await page.getByRole('tab', { name: /Discover you/ }).click();
    await expect(page.locator('textarea').first()).toBeVisible();
  });

  test('Your projects tab opens', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const tab = page.getByRole('tab', { name: /Your projects/ });
    await tab.click();
    // The old test clicked and asserted nothing at all, so it passed even when
    // the click did not select the tab.
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  test('Your portfolio page tab opens', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    const tab = page.getByRole('tab', { name: /Your portfolio page/ });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  test('sidebar is visible', async ({ page }) => {
    await goto(page, Routes.portfolioExplorer);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
