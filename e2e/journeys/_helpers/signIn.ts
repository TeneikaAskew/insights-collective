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

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

/**
 * Access token for the instructor account, obtained out-of-band so a spec can
 * act as grading staff without disturbing the member session in the page.
 *
 * Grading columns (score, grade, grader_comments, rubric_scores, graded_at) are
 * pinned by the pin_assignment_grade_columns trigger for anyone who is not
 * is_grading_staff(). A student's own token silently loses those values while
 * PostgREST still answers 200, so grading with the member token looks like it
 * worked and writes nothing.
 */
export async function getInstructorAccessToken(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    data: {
      email: process.env.E2E_INSTRUCTOR_EMAIL ?? 'e2e-instructor@insightscollective.org',
      password:
        process.env.E2E_INSTRUCTOR_PASSWORD ??
        process.env.E2E_TEST_PASSWORD ??
        'TestPass123!',
    },
  });
  if (!res.ok()) {
    throw new Error(
      `Instructor sign-in failed (${res.status()}). Set E2E_INSTRUCTOR_EMAIL / E2E_INSTRUCTOR_PASSWORD.`,
    );
  }
  const body = await res.json();
  if (!body.access_token) throw new Error('Instructor sign-in returned no access_token.');
  return body.access_token as string;
}
