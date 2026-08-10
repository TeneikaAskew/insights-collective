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

  test('platform KPI tiles render with their labels', async ({ page }) => {
    await goto(page, Routes.admin);
    // The dashboard's own KPIs (AdminDashboard.tsx `kpis`), not the four tiles
    // belonging to the ResourceManagement panel lower down the page — those are
    // a different component, and asserting them would leave the KPI block free
    // to disappear unnoticed. This test replaces one whose locator was
    // [class*="card"], which matches every shadcn Card including the shell.
    for (const label of ['Total Users', 'Total Courses', 'Active Enrollments', 'Certificates Issued']) {
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

  test('recent activity card links out to the full log', async ({ page }) => {
    await goto(page, Routes.admin);
    // This card deliberately shows NO feed — AdminDashboard.tsx calls that out
    // in a comment ("no fabricated feed") — so what it must contain is the way
    // through to the real log. Scoped to the section, because Content/Type/
    // Source are columns of the unrelated resources table further down and
    // asserting those would pass even with this card gutted.
    const card = page.locator('section').filter({ hasText: 'Recent Activity' }).first();
    await expect(card.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
    await expect(card.getByRole('link', { name: 'View All' })).toBeVisible();
    await expect(card.getByRole('link', { name: 'full activity log' })).toBeVisible();
  });

  test('admin section navigation is visible', async ({ page }) => {
    await goto(page, Routes.admin);
    // Scoped to AdminLayout's own nav. An unscoped a[href*="/admin/"] count is
    // satisfied by the dashboard's six quick-action launchers alone, so the
    // rail could be removed entirely and the count would still clear any floor
    // worth setting.
    //
    // Both navs are matched because AdminLayout renders TWO and hides one by
    // width: the desktop rail is <aside><nav> with no aria-label, and the
    // labeled nav[aria-label="Admin sections"] is the md:hidden mobile pill
    // strip. Targeting the label alone finds nothing at desktop width — the
    // element exists but is hidden — so the locator has to accept either and
    // :visible picks whichever the viewport is actually showing.
    const nav = page
      .locator('aside nav, nav[aria-label="Admin sections"]')
      .filter({ visible: true })
      .first();
    await expect(nav).toBeVisible();
    expect(await nav.getByRole('link').count()).toBeGreaterThan(0);
  });
});
