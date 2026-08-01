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
 * Assert an unauthenticated user ends up on the login page.
 * Supabase auth check is async so we poll: wait up to 25s for the URL to
 * change to /login. If the app renders a loading state first that's fine —
 * the guard will eventually redirect.  We then verify the email input is
 * visible to confirm it's the real login page (not a blank redirect).
 */
export async function expectRedirectToLogin(page: Page): Promise<void> {
  // Wait for either: URL changes to /login, or the #email input appears
  // (in case the route doesn't change but the login form is shown inline)
  await Promise.race([
    expect(page).toHaveURL(/\/login/, { timeout: 25_000 }),
    expect(page.locator('#email')).toBeVisible({ timeout: 25_000 }),
  ]);
  // After redirect stabilises, confirm the login form is present
  await expect(page.locator('#email')).toBeVisible({ timeout: 30_000 });
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
