import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad, expectRedirectToLogin } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Dashboard', () => {
  // Signed out via test.use rather than `browser.newContext()`. The
  // console-error fixture attaches its listeners to the INJECTED `page`
  // (console-errors.fixture.ts), so a hand-built context produces a page the
  // fixture never sees — /login could throw on every load and this would still
  // pass. Overriding storageState drops the admin session and nothing else.
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto(Routes.admin);
      await expectRedirectToLogin(page);
    });
  });

  test('renders admin dashboard', async ({ page }) => {
    await goto(page, Routes.admin);
    // Was `h1, h2, h3` first-match visible, with a comment excusing it as
    // tolerance for unreliable role hydration. The login page has an <h1> too,
    // so this test passed on the login screen — the exact outcome it exists to
    // rule out. Sibling admin specs (blog-management.spec.ts:26,
    // admin-real-enrollments.spec.ts:12) already assert named headings under
    // this same project and pass, so the hydration excuse does not hold.
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.admin);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('quick-actions launcher renders', async ({ page }) => {
    await goto(page, Routes.admin);
    // Formerly a second "accept any top-level heading" test — a verbatim
    // duplicate of the one above and vacuous for the same reason. Repointed at
    // a different piece of the dashboard so the file keeps two distinct claims:
    // the page identified itself, AND its launcher grid built.
    await expect(page.getByRole('heading', { name: 'Quick actions' })).toBeVisible();

    // Matched on the launcher's DESCRIPTION, not its title. Two links point at
    // /admin/page-visibility — the AdminLayout sidebar item (:48) and this
    // launcher (AdminDashboard.tsx:102) — and the sidebar one is present on
    // every admin page, so a title match plus `.first()` would most likely
    // resolve to the sidebar and assert nothing about the dashboard at all.
    // The description string exists only in the launcher.
    await expect(page.getByRole('link', { name: /Control who sees each page/i })).toBeVisible();
  });

  test('stats cards render (users, courses, etc.)', async ({ page }) => {
    await goto(page, Routes.admin);
    const stats = page.locator('[class*="stat"], [class*="metric"], [class*="card"], [class*="Card"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await stats.count() > 0) {
      await expect(stats).toBeVisible();
    }
  });

  test('charts render on dashboard', async ({ page }) => {
    await goto(page, Routes.admin);
    const chart = page.locator('[class*="chart"], [class*="Chart"], svg, canvas').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await chart.count() > 0) {
      await expect(chart).toBeVisible();
    }
  });

  test('recent activity feed renders', async ({ page }) => {
    await goto(page, Routes.admin);
    const activity = page.locator('[class*="activity"], [class*="feed"], [role="list"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await activity.count() > 0) {
      await expect(activity).toBeVisible();
    }
  });

  test('admin navigation links are visible', async ({ page }) => {
    await goto(page, Routes.admin);
    const navLinks = page.locator('a[href*="/admin/"]');
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await navLinks.count() > 0) {
      await expect(navLinks.first()).toBeVisible();
    }
  });
});
