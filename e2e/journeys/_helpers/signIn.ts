// ABOUTME: Shared sign-in + Supabase token retrieval helpers for journey specs.
// ABOUTME: Handles both the legacy `supabase.auth.token` key and the modern
// ABOUTME: `sb-<ref>-auth-token` key the Supabase JS v2 client actually writes.
import type { Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

/**
 * Ensures the calling project's session is live in the page.
 *
 * Despite the name this does not pick an account: it hydrates whatever
 * `storageState` the running project supplies, which global-setup established.
 * Callers in chromium-member act as the shared member; callers in
 * chromium-member-journeys act as the dedicated journeys account. Specs that
 * need the acting user's id must read it from /auth/v1/user rather than assume.
 *
 * This used to drive the real /login form on every test, which was pure
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
