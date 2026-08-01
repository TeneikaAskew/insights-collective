import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';
import { expectVisibilityGuard, isHiddenFromViewer } from '../helpers/visibility-helpers';

// These tests assert that each route renders ITS OWN page. Page visibility is
// admin-controlled production data, so a route's expected render depends on the
// live configuration: an admin-hidden section must render the visibility gate,
// and everything else must render its content. Each test below asserts whichever
// of those two applies — neither branch is a pass-by-default. The gate's own
// mechanics are covered by navigation/page-visibility.spec.ts, and
// navigation/live-visibility-config.spec.ts fails if a page is hidden in
// production without a signed-off reason, so "hidden" can never become a way to
// quietly drop coverage.
test.describe('Additional Route Coverage', () => {
  test('user dashboard renders roadmap and next steps content', async ({ page }) => {
    await goto(page, Routes.userDashboard);
    if (await isHiddenFromViewer(Routes.userDashboard)) {
      await expectVisibilityGuard(page);
      return;
    }
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('text=Roadmap Timeline')).toBeVisible();
    await expect(page.locator('text=Next Steps')).toBeVisible();
  });

  test('legacy course list alias renders browse controls', async ({ page }) => {
    await goto(page, Routes.legacyCourseList);
    if (await isHiddenFromViewer(Routes.legacyCourseList)) {
      await expectVisibilityGuard(page);
      return;
    }
    await expect(page.locator(Sel.searchInput).first()).toBeVisible();
    await expect(page.locator('text=Courses').first()).toBeVisible();
  });

  test('forums alias redirects to dashboard', async ({ page }) => {
    await page.goto(Routes.forums);
    // /forums redirects to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('assistant-interface legacy route renders the default assistant shell', async ({ page }) => {
    await goto(page, Routes.assistantInterfaceLegacy);
    // /assistant-interface is an alias of the /assistants section, which the
    // owner has hidden. While it stays hidden the gate is the correct render;
    // restoring it in Admin → Page Visibility turns the composer assertion back
    // on with no code change here.
    if (await isHiddenFromViewer(Routes.assistantInterfaceLegacy)) {
      await expectVisibilityGuard(page);
      return;
    }
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await expect(
      page.locator('textarea, input[placeholder*="message"], input[placeholder*="question"], [contenteditable="true"]').first(),
    ).toBeVisible();
  });

  test('unknown route renders not-found page with recovery link', async ({ page }) => {
    await goto(page, Routes.notFound);
    await expect(page.locator('h1:has-text("404")')).toBeVisible();
    await expect(page.locator('text=Oops! Page not found')).toBeVisible();
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });
});
