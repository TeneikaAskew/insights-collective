// ABOUTME: Shared sign-in + Supabase token retrieval helpers for journey specs.
// ABOUTME: Handles both the legacy `supabase.auth.token` key and the modern
// ABOUTME: `sb-<ref>-auth-token` key the Supabase JS v2 client actually writes.
import type { Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

/**
 * Ensures the member session is live in the page.
 *
 * Every caller runs under the chromium-member project, whose `storageState` is
 * the session global-setup already established — so there is nothing to log in
 * to. This used to drive the real /login form on every test, which was pure
 * redundant work and could only add failure surface: a slow or failed login
 * left the page on /login and every later locator timed out. Loading the app
 * is enough to hydrate the stored session.
 */
export async function signInMember(page: Page): Promise<void> {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

export async function getSupabaseAccessToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (
        (k.startsWith('sb-') && k.endsWith('-auth-token')) ||
        k === 'supabase.auth.token'
      ) {
        try {
          const raw = localStorage.getItem(k)!;
          const parsed = JSON.parse(raw) as any;
          const token =
            parsed?.access_token ??
            parsed?.currentSession?.access_token ??
            (Array.isArray(parsed) ? parsed[0] : null);
          if (token) return token as string;
        } catch {
          // ignore malformed entries
        }
      }
    }
    return null;
  });
}
