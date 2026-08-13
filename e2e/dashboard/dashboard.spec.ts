import { test, expect } from '../fixtures/page-helpers';
import { goto, expectRedirectToLogin, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Dashboard', () => {
  // The reason now travels WITH the skip instead of sitting in a comment no
  // report can read: CI's coverage-gap step lists every skipped test, and a
  // reason it cannot see is a reason nobody reviewing the summary ever sees.
  //
  // This one had no comment at all. Same mechanism as calendar.spec.ts, which
  // was re-skipped after CI disproved the assumption that /dashboard redirects:
  // Dashboard renders its own <Navigate to="/login?redirect=..."> but sits
  // inside <Route element={<VisibilityGate/>}>, so the gate decides what mounts
  // first and the redirect does not necessarily run.
  //
  // Wrapped in a signed-out describe even though it is skipped, so unskipping in
  // PR 8 is a one-word change that is already correct: this file runs under
  // chromium-member, and dropping the session via test.use (rather than a
  // hand-built context) keeps the page under the console-error fixture.
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.skip(
      'unauthenticated user is redirected to login',
      {
        annotation: {
          type: 'skip-reason',
          description:
            'Blocked on PR 8: /dashboard has no ProtectedRoute — it self-redirects from inside VisibilityGate, so what a signed-out visitor sees is undecided. See calendar.spec.ts for the CI run that disproved the redirect.',
        },
      },
      async ({ page }) => {
        await page.goto(Routes.dashboard);
        await expectRedirectToLogin(page);
      },
    );
  });

  test('renders dashboard heading for authenticated user', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(
      page.locator('h1, h2').filter({ hasText: /dashboard/i }).first(),
    ).toBeVisible();
  });

  test('loading spinner resolves', async ({ page }) => {
    await page.goto(Routes.dashboard);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('sidebar navigation is present', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });

  test('tabs are visible and clickable', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    if (count > 0) {
      await tabs.first().click();
    }
  });

  test('course card links navigate to course detail', async ({ page }) => {
    await goto(page, Routes.dashboard);
    const courseCards = page.locator('a[href*="/courses/"]');
    const count = await courseCards.count();
    if (count > 0) {
      const href = await courseCards.first().getAttribute('href');
      expect(href).toMatch(/\/courses\//);
    }
  });

  // Each stat card selects the tab that answers it. On a phone that tab's panel
  // is a full screen below the fold, so a card that only changes state reads as
  // a dead control — the viewport has to follow.
  test.describe('stat cards', () => {
    const CARDS = [
      { name: /Enrolled Courses: \d+/, tab: 'My Courses' },
      { name: /In Progress: \d+/, tab: 'My Courses' },
      { name: /Notifications: \d+/, tab: 'Notifications' },
      { name: /Upcoming Deadlines: \d+/, tab: /Calendar/ },
    ];

    for (const card of CARDS) {
      test(`${card.name.source} selects its tab and brings it into view`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await goto(page, Routes.dashboard);

        const scrollTop = () =>
          page.evaluate(() => document.querySelector('main')?.scrollTop ?? -1);
        const before = await scrollTop();

        await page.getByRole('button', { name: card.name }).click();

        const tab = page.getByRole('tab', { name: card.tab });
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(tab).toBeInViewport();
        // Smooth scrolling is animated, so poll rather than read once.
        await expect.poll(scrollTop).toBeGreaterThan(before);
      });
    }

    test('cards are reachable and operable from the keyboard', async ({ page }) => {
      await goto(page, Routes.dashboard);

      // REGRESSION: these were <div onClick>, so they had no tab stop and no
      // Enter/Space handling — mouse-only, and silent to a screen reader.
      const card = page.getByRole('button', { name: /Upcoming Deadlines: \d+/ });
      await card.focus();
      await expect(card).toBeFocused();
      await page.keyboard.press('Enter');

      await expect(page.getByRole('tab', { name: /Calendar/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    test('a card names the action it performs', async ({ page }) => {
      await goto(page, Routes.dashboard);

      // "Enrolled Courses 2" describes the number but not the destination.
      await expect(
        page.getByRole('button', { name: /Enrolled Courses: \d+\. Show My Courses/ }),
      ).toBeVisible();
    });
  });

  test('Browse Courses button is visible', async ({ page }) => {
    await goto(page, Routes.dashboard);
    // It is an anchor, not a button, and it goes to the catalog. The old
    // union's `button:has-text("Courses")` alternative would also have been
    // satisfied by the "My Courses" tab, so `.first()` could pass with the
    // Browse control gone.
    const browse = page.getByRole('link', { name: 'Browse Courses' });
    await expect(browse).toBeVisible();
    await expect(browse).toHaveAttribute('href', '/courses');
  });
});
