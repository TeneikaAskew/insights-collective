import { Page, expect } from '@playwright/test';

/**
 * Wait for React Suspense / lazy-load spinner to disappear.
 * All pages are lazy-loaded, so this must be called after navigation.
 */
export async function waitForPageLoad(page: Page, timeout = 15_000): Promise<void> {
  // domcontentloaded fires when the HTML is parsed, which for a Vite SPA is before
  // React has mounted anything.
  await page.waitForLoadState('domcontentloaded');

  // React has to have mounted before "wait for the spinner to go away" means
  // anything. Playwright counts a not-yet-rendered element as hidden, so when this
  // helper ran against an empty #root the spinner wait below resolved INSTANTLY and
  // the helper returned while the page was still blank. Every assertion after it
  // then raced the app's first paint, and only the assertion's own 10s expect
  // timeout stood between that race and a failure — which is how
  // navigation/page-visibility.spec.ts intermittently failed to find the login
  // form. Waiting for the shell to exist first is what makes the spinner wait real.
  try {
    await page.locator('#root > *').first().waitFor({ state: 'attached', timeout });
  } catch {
    // Not the SPA shell (a static error page, say) — nothing further to wait for.
  }

  // .first() is load-bearing. waitFor is strict, so once a page rendered more than
  // one spinner this threw a strict-mode violation rather than waiting, and the
  // catch swallowed it — vacuous for a second reason.
  try {
    await page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout });
  } catch {
    // No spinner found — that's fine.
  }
}

/**
 * Navigate and wait for the page to be fully loaded.
 */
export async function goto(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await waitForPageLoad(page);
}

/**
 * Assert a Sonner / Radix toast notification appeared.
 */
export async function expectToast(page: Page, text?: string): Promise<void> {
  const toast = page.locator('[data-sonner-toast], [role="status"]').first();
  await expect(toast).toBeVisible({ timeout: 5_000 });
  if (text) {
    await expect(toast).toContainText(text);
  }
}

/**
 * Assert an unauthenticated visitor ends up ON the login page.
 *
 * The URL assertion used to be decorative. It sat inside a `Promise.race`
 * against "#email is visible", and `Promise.race` settles on the FIRST
 * outcome — so as soon as an email input appeared anywhere, the race resolved
 * and the URL expectation was abandoned mid-flight, its result discarded. The
 * only surviving assertion was the line after it, which checks #email again.
 * Net effect: the helper asserted "this page contains an email input", and any
 * route rendering an inline sign-in card satisfied it **without redirecting**.
 * That is precisely the difference between a guarded route and an unguarded
 * one, which is the single thing these tests exist to measure.
 *
 * Now it is sequential, and the order is the contract: land on /login FIRST,
 * then confirm it is the real login page rather than a blank shell.
 *
 * `ProtectedRoute` (src/components/ProtectedRoute.tsx:133-135) renders
 * `<Navigate to="/login" replace/>` once auth settles with no session, so the
 * URL genuinely changes — this is not an aspirational assertion. The 25s
 * budget covers the "Verifying access..." spinner the guard holds the route
 * with while `loading` is true.
 *
 * Callers whose route has no synchronous guard will now FAIL rather than pass
 * on an inline sign-in card. That is the intended signal; PR 8 wraps the
 * remaining eight routes in `ProtectedRoute`, and until then those specs stay
 * skipped with a stated reason rather than green for the wrong reason.
 */
export async function expectRedirectToLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/, { timeout: 25_000 });
  await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
}

/**
 * Click a Radix/shadcn tab by label and wait for its panel to appear.
 */
export async function clickTab(page: Page, label: string): Promise<void> {
  await page.locator(`[role="tab"]:has-text("${label}")`).click();
  await page.waitForTimeout(300);
}

/**
 * Intercept Supabase OAuth redirects so tests don't leave the app.
 */
export async function interceptOAuth(page: Page): Promise<void> {
  await page.route('**/auth/v1/authorize**', (route) => route.abort());
}
