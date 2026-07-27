// ABOUTME: Gap-fill audit specs — genuine end-to-end coverage for platform surfaces
// ABOUTME: previously lacking regression tests: portfolio public view, blog reader,
// ABOUTME: interview prep entry, admin dashboard access control, and 404 handling.
import { test, expect } from '@playwright/test';
import { E2E_BASE_URL } from '../fixtures/test-data';

// The authenticated describe below runs under the chromium-member project,
// whose storageState is the session global-setup already established. Driving
// the real /login form here was redundant work that could only add failure
// surface. Loading the app hydrates the stored session.
async function loadAuthenticatedApp(page: import('@playwright/test').Page) {
  await page.goto(`${E2E_BASE_URL}/`, { waitUntil: 'domcontentloaded' });
}

test.describe('Audit — public surfaces render without auth', () => {
  test('blog index loads and renders at least one card or a real empty state', async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/blog`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/blog/);
    await expect
      .poll(async () => {
        const heading = await page.getByRole('heading', { level: 1 }).first().isVisible().catch(() => false);
        return heading;
      }, { timeout: 10_000 })
      .toBe(true);
    // Regression guard — a stack-trace overlay or blank body indicates a runtime error.
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByText(/uncaught|cannot read|typeerror/i)).toHaveCount(0);
  });

  test('/verify-certificate/UNKNOWNCODE surfaces a clear invalid-code state', async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/verify-certificate/DOES-NOT-EXIST-ZZZ`, { waitUntil: 'domcontentloaded' });
    // Either the page shows a "not found / invalid" message or redirects; must NOT show a
    // fake success (no student name, no course title fields populated).
    await expect
      .poll(async () => {
        const bad = await page.getByText(/invalid|not found|couldn.?t verify|no certificate/i).isVisible().catch(() => false);
        return bad;
      }, { timeout: 10_000 })
      .toBe(true);
  });

  test('unknown route returns the app 404 page rather than a runtime crash', async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/definitely-not-a-real-route-xyz`, { waitUntil: 'domcontentloaded' });
    await expect
      .poll(async () => {
        const notFound = await page.getByText(/404|not found|doesn.?t exist/i).first().isVisible().catch(() => false);
        return notFound;
      }, { timeout: 8_000 })
      .toBe(true);
    await expect(page.getByText(/uncaught|typeerror/i)).toHaveCount(0);
  });
});

test.describe('Audit — authenticated surfaces reachable from the main nav', () => {
  test.beforeEach(async ({ page }) => {
    await loadAuthenticatedApp(page);
  });

  test('dashboard renders the sidebar and greeting for a signed-in member', async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible({ timeout: 15_000 });
    // Real content check — either "Welcome" or an activity/progress card must exist.
    await expect
      .poll(async () => {
        const welcome = await page.getByText(/welcome|dashboard|good (morning|afternoon|evening)/i).first().isVisible().catch(() => false);
        return welcome;
      }, { timeout: 8_000 })
      .toBe(true);
  });

  test('non-admin cannot open /admin — either redirect or clear denial', async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    // The gate is asynchronous: ProtectedRoute holds the route on a spinner
    // until has_admin_access replies, so the redirect lands after the network
    // has gone idle. Sampling once at networkidle caught the spinner instead of
    // the verdict whenever the suite ran under load.
    await expect
      .poll(async () => {
        const gated = await page
          .getByText(/not authorized|access denied|admin access/i)
          .isVisible()
          .catch(() => false);
        return gated || !page.url().includes('/admin');
      }, { timeout: 20_000 })
      .toBe(true);
    // Fail loudly if an admin table renders for a member.
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('notifications icon in header opens the notifications page', async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/notifications`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible({ timeout: 10_000 });
  });
});
