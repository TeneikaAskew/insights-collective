import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Sel } from '../fixtures/test-ids';
import { Routes } from '../helpers/route-helpers';

test.describe('Authenticated Session Flows', () => {
  test('authenticated user visiting login is redirected to requested page', async ({ page }) => {
    await page.goto(`${Routes.login}?redirect=${encodeURIComponent(Routes.profile)}`);
    await expect(page).toHaveURL(new RegExp(`${Routes.profile}$`));
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('member session survives reload on dashboard', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await expect(page.locator(Sel.nav.sidebar)).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(new RegExp(`${Routes.dashboard}$`));
    await expect(page.locator(Sel.nav.sidebar)).toBeVisible();
  });

  test('sign out from sidebar returns user to login', async ({ page }) => {
    await goto(page, Routes.dashboard);
    await page.click(Sel.nav.logoutBtn);
    await expect(page).toHaveURL(/\/login|\/$/);
  });
});
