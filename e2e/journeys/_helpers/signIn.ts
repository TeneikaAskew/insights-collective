// ABOUTME: Shared sign-in + Supabase token retrieval helpers for journey specs.
// ABOUTME: Handles both the legacy `supabase.auth.token` key and the modern
// ABOUTME: `sb-<ref>-auth-token` key the Supabase JS v2 client actually writes.
import type { Page } from '@playwright/test';

// NOTE: these env reads use `||`, not `??`, on purpose. A GitHub Actions
// `${{ secrets.X }}` for a secret that does not exist expands to the EMPTY
// STRING, not to undefined — and `'' ?? fallback` is `''`. With `??` the
// helper silently signed in with an empty password, so login never left
// /login and every later page.fill timed out. Keep `||` here.
const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const EMAIL =
  process.env.E2E_MEMBER_EMAIL ||
  process.env.E2E_TEST_EMAIL ||
  'e2e-member@insightscollective.org';
const PASSWORD =
  process.env.E2E_MEMBER_PASSWORD ||
  process.env.E2E_TEST_PASSWORD ||
  'TestPass123!';

export async function signInMember(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20_000 });
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
