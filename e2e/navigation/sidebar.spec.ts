// ABOUTME: The app sidebar on /dashboard — its links, its active state, and the
// ABOUTME: rail that collapses it.
//
// WHAT THE COUNT-GUARDS IN HERE WERE HIDING
//
// Seven tests sat behind `if (await x.count() > 0)`. Probing the real DOM
// showed four of the locators matched something and two matched NOTHING, which
// means those two tests had never executed a single assertion:
//
//   dashboard / courses / resources / interview-prep links   present, visible
//   [data-sidebar="trigger"], button[aria-label*="sidebar"]  ZERO matches
//   button:has-text("Sign out"|"Log out"|"Logout")           ZERO matches
//
// The toggle failed for two compounding reasons. `SidebarTrigger` is imported
// by AppSidebar and never rendered — the control that collapses the sidebar is
// `SidebarRail`. And the fallback `aria-label*="sidebar"` could not match
// `aria-label="Toggle Sidebar"` either, because CSS attribute substring
// matching is case-sensitive.
//
// Sign out is not in the sidebar at all; it lives in the Navbar's ProfileMenu
// dropdown, and session-flows.spec.ts already covers it from there. That test
// is gone from this file rather than rewritten, because a copy here would be a
// second assertion about a component this spec is not about.

import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('App Sidebar', () => {
  /** Scoped to the sidebar: /courses is also linked from page content. */
  const sidebar = (page: import('@playwright/test').Page) =>
    page.locator('[data-sidebar="sidebar"]');

  test('sidebar is visible on dashboard', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });

  test('sidebar contains dashboard link', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(sidebar(page).locator('a[href="/dashboard"]').first()).toBeVisible();
  });

  test('sidebar contains courses link', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(sidebar(page).locator('a[href="/courses"]').first()).toBeVisible();
  });

  test('active route is highlighted in sidebar', async ({ page }) => {
    await goto(page, Routes.courses);
    // data-active is the signal SidebarMenuButton actually sets. The old
    // selector also tried `[class*="active"]`, which matches the Tailwind
    // variant `active:bg-sidebar-accent` on EVERY menu button whether or not it
    // is the current route — so it would have been satisfied by any link.
    await expect(
      sidebar(page).locator('a[href="/courses"][data-active="true"]').first(),
    ).toBeVisible();
  });

  test('sidebar rail collapses and expands the sidebar', async ({ page }) => {
    await goto(page, Routes.dashboard);

    const shell = page.locator('[data-state][data-collapsible], [data-state]').first();
    const rail = page.locator('[data-sidebar="rail"]').first();
    await expect(rail).toBeVisible();

    const stateBefore = await shell.getAttribute('data-state');
    await rail.click();
    // Assert the state actually flipped. The old test clicked twice and
    // asserted nothing at all, so it passed even when the click did nothing.
    await expect(shell).not.toHaveAttribute('data-state', stateBefore ?? '');

    await rail.click();
    await expect(shell).toHaveAttribute('data-state', stateBefore ?? '');
  });

  test('resources link navigates to resources', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await sidebar(page).locator('a[href="/resources"]').first().click();
    await expect(page).toHaveURL(/\/resources/);
  });

  test('interview prep link is present in sidebar', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(sidebar(page).locator('a[href="/interview-prep"]').first()).toBeVisible();
  });
});
