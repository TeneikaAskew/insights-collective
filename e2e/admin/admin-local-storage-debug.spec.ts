import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

// THIS ROUTE ONLY EXISTS IN A DEV BUILD.
//
// src/App.tsx:453 wraps it in `import.meta.env.DEV`, so the production bundle
// CI serves has no /admin/debug/storage at all — the path falls through to the
// admin shell. Every assertion below therefore describes a page that CI never
// renders, which is why this file's three original assertions were "body is not
// empty", "no spinner" and "some h1 or h2 exists": all true of the fallback.
// Together with the count-guards on everything else, the file has never tested
// this page in CI even once.
//
// Same shape as resume-design/soft-studio.spec.ts, and the same trade-off,
// stated rather than buried: probing for the page means a genuine dev-only
// regression skips instead of failing. The probe is deliberately narrow — the
// page's OWN heading, not "did anything render" — so it only absorbs the route
// being absent, not the page being broken.
test.describe('Admin LocalStorage Debug', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
    // waitFor, not isVisible(): a one-shot read has no retry, and this route is
    // React.lazy'd, so a slow chunk would read "absent" and skip the tests in
    // the one environment where they DO work. The timeout bounds how long a
    // production build — where the route genuinely does not exist — waits
    // before skipping.
    const served = await page
      .getByRole('heading', { name: 'LocalStorage Debug' })
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!served, 'dev-only route: src/App.tsx:453 gates /admin/debug/storage behind import.meta.env.DEV, so a production build does not serve it');
  });

  test('renders debug page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'LocalStorage Debug' })).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'LocalStorage Debug' })).toBeVisible();
  });

  test('localStorage contents round-trip through the page', async ({ page }) => {
    // MEASURED: this page renders no <pre>, no <code> and no <table>, so the
    // old locator's only live alternatives were the two [class*=] ones, and
    // the count-guard made a miss indistinguishable from a hit. Its comment
    // ("at minimum the auth token key") was also wrong: the page reports
    // "Total localStorage items detected: 0" for a signed-in admin, because
    // Supabase's session is not in this origin's localStorage under the key it
    // scans for.
    //
    // So rather than asserting whatever happens to be in storage — which is
    // neither seeded nor stable — this drives the page's OWN affordance and
    // checks the display reflects it. That covers what the test was named for
    // and cannot pass on an empty page.
    await expect(page.getByRole('heading', { name: 'Storage Contents' })).toBeVisible();

    // The UNCONDITIONAL control (LocalStorageDebug.tsx:248), not the
    // empty-state one at :372 that renders only while items.length === 0.
    // Both call the same handler, but the empty-state button disappears the
    // moment storage has anything in it — so a test that clicks it is a test
    // that only works while the page is failing to see the admin session's own
    // keys. exact, because the longer label at :372 contains this one.
    await page.getByRole('button', { name: 'Create Test Item', exact: true }).click();

    // The page announces the key it just wrote; read it back and require it in
    // the listing. Deliberately NOT an item count: the mount-time scan reports
    // 0 and the post-create scan reported 4, because the app's own keys
    // (e2e:disable-tours, redirectAfterLogin, supabase.auth.token) land between
    // the two reads. Any absolute number here would be asserting a race, and
    // would differ again under CI's non-relay origin.
    const announcement = page.getByText(/Test key created: test_\d+/);
    await expect(announcement).toBeVisible();
    const key = ((await announcement.textContent()) || '').replace('Test key created: ', '').trim();

    const contents = page.getByText(new RegExp(`${key}:Test value created at`));
    await expect(contents).toBeVisible();
  });

  test('clear or delete key button is present', async ({ page }) => {
    // Both clear controls by name. The old union with `.first()` never
    // established which one it had found, so either disappearing was invisible.
    await expect(page.getByRole('button', { name: 'Clear Resume Data' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear All Resume/Job Data' })).toBeVisible();
  });

  test('refresh button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});
