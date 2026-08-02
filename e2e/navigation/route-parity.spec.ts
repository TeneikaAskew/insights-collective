import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Additional Route Coverage', () => {
  // The /user-dashboard test is GONE, along with the route. It was a fossil: a
  // second dashboard, reachable only by typing the URL, linked from nowhere and
  // superseded by /dashboard. Its production page_visibility row is deleted too,
  // so the admin's Page Visibility screen stops offering a toggle for a page
  // that no longer exists.

  test('legacy course list alias renders browse controls', async ({ page }) => {
    await goto(page, Routes.legacyCourseList);
    await expect(page.locator(Sel.searchInput).first()).toBeVisible();
    await expect(page.locator('text=Courses').first()).toBeVisible();
  });

  test('forums alias redirects to dashboard', async ({ page }) => {
    await page.goto(Routes.forums);
    // /forums redirects to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('assistant-interface legacy alias lands where /assistants lands', async ({ page }) => {
    // This asserted that the page renders a message composer. That is a claim
    // about the assistant feature, not about the alias, and it broke the moment
    // an admin toggled /assistants off in page_visibility — the alias resolves
    // through the same gate, so both pages correctly showed "Coming Soon" and
    // the spec called it a routing failure.
    //
    // What this file is for is parity: /assistant-interface must render
    // whatever /assistants renders. Comparing the two says exactly that and
    // stays true whichever side of the gate the section is on.
    await goto(page, Routes.assistants);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    const canonical = await page.locator('main, [role="main"]').first().innerText();

    await goto(page, Routes.assistantInterfaceLegacy);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    const legacy = await page.locator('main, [role="main"]').first().innerText();

    expect(legacy.trim()).toBe(canonical.trim());
  });

  test('unknown route renders not-found page with recovery link', async ({ page }) => {
    await goto(page, Routes.notFound);
    await expect(page.locator('h1:has-text("404")')).toBeVisible();
    await expect(page.locator('text=Oops! Page not found')).toBeVisible();

    // Scoped to the 404 block on purpose. The page renders inside AppLayout now,
    // and the sidebar header is itself a link home — so a bare a[href="/"] both
    // matches two elements (strict mode) and, if it were relaxed with .first(),
    // would be satisfied by the sidebar logo whether or not the 404 page offers
    // a way back at all. The assertion is about THIS page's recovery link.
    await expect(page.getByTestId('not-found').locator('a[href="/"]')).toBeVisible();
  });
});
