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

  test('stat tiles render with their labels', async ({ page }) => {
    await goto(page, Routes.admin);
    // The four tiles by name. The old locator's widest alternative,
    // [class*="card"], matches every shadcn Card on the page — including the
    // page shell — so it was satisfied whether or not a single statistic
    // rendered.
    for (const label of ['Total Resources', 'Categories', 'Resource Types', 'With Deadlines']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  // There are no charts on this page. Measured: 0 .recharts-wrapper elements.
  // The old locator was `[class*="chart"], [class*="Chart"], svg, canvas` — and
  // `svg` matches every lucide icon in the navbar, so the test passed on an
  // icon and would have gone on passing if a chart were never added.
  //
  // Skipped rather than deleted: "the admin dashboard should show charts" may
  // well be intended, and a named skip keeps that visible where a deletion
  // would quietly drop it.
  test.skip(
    'charts render on dashboard',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'UI gap: /admin renders no chart (0 .recharts-wrapper). The previous assertion passed on a lucide icon because its locator included a bare `svg`.',
      },
    },
    async ({ page }) => {
      await goto(page, Routes.admin);
      await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
    },
  );

  test('recent activity feed renders', async ({ page }) => {
    await goto(page, Routes.admin);
    // The section by its heading, plus the table it contains. `[role="list"]`
    // in the old locator matches any list on the page, navigation included.
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
    for (const col of ['Content', 'Type', 'Source']) {
      await expect(page.locator('th').filter({ hasText: col }).first()).toBeVisible();
    }
  });

  test('admin navigation links are visible', async ({ page }) => {
    await goto(page, Routes.admin);
    const navLinks = page.locator('a[href*="/admin/"]').filter({ visible: true });
    await expect(navLinks.first()).toBeVisible();
    // Measured at 20. A floor rather than the exact count, so adding an admin
    // section does not fail the test, but losing the whole nav does.
    expect(await navLinks.count()).toBeGreaterThanOrEqual(5);
  });
});
