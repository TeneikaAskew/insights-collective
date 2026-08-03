import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin LocalStorage Debug', () => {
  test('renders debug page', async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
    // Page may render outside of <main> — verify body rendered
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminLocalStorageDebug);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('localStorage contents round-trip through the page', async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
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
    await goto(page, Routes.adminLocalStorageDebug);
    // Both clear controls by name. The old union with `.first()` never
    // established which one it had found, so either disappearing was invisible.
    await expect(page.getByRole('button', { name: 'Clear Resume Data' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear All Resume/Job Data' })).toBeVisible();
  });

  test('refresh button is present', async ({ page }) => {
    await goto(page, Routes.adminLocalStorageDebug);
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});
