import { Page, expect } from '@playwright/test';

/**
 * Wait for React Suspense / lazy-load spinner to disappear.
 * All pages are lazy-loaded, so this must be called after navigation.
 */
export async function waitForPageLoad(page: Page, timeout = 15_000): Promise<void> {
  // Wait for the document to reach an interactive state
  await page.waitForLoadState('domcontentloaded');
  // Wait for any spinning loaders to vanish
  try {
    await page.locator('.animate-spin').waitFor({ state: 'hidden', timeout });
  } catch {
    // No spinner found — that's fine
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
 * Assert an unauthenticated user is redirected to the login page.
 */
export async function expectRedirectToLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  await expect(page.locator('#email')).toBeVisible();
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
