// ABOUTME: Shared sign-in + Supabase token retrieval helpers for journey specs.
// ABOUTME: Handles both the legacy `supabase.auth.token` key and the modern
// ABOUTME: `sb-<ref>-auth-token` key the Supabase JS v2 client actually writes.
import type { Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

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

/**
 * Mints a standalone access token for the seeded instructor account.
 *
 * Grading is staff-only at the database level: `pin_assignment_grade_columns`
 * silently reverts score/grade/graded_at/grader_comments/rubric_scores on any
 * UPDATE whose caller fails `is_grading_staff()`. A student PATCHing their own
 * submission therefore still gets a 2xx — the write just loses the grade
 * columns — so specs that "grade" with the student's own token see
 * `workflow_state = 'graded'` render while the score never appears.
 *
 * Use this for the grading step so the write is made by someone who is
 * actually allowed to grade. It talks to the token endpoint directly and does
 * not touch the page's localStorage, so the browser stays signed in as the
 * student whose view the spec is asserting on.
 */
export async function getInstructorAccessToken(): Promise<string> {
  const email = process.env.E2E_INSTRUCTOR_EMAIL || 'e2e-instructor@insightscollective.org';
  const password = process.env.E2E_INSTRUCTOR_PASSWORD || process.env.E2E_TEST_PASSWORD;
  if (!password) {
    throw new Error(
      'E2E_INSTRUCTOR_PASSWORD (or E2E_TEST_PASSWORD) must be set to grade as the instructor',
    );
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(
      `instructor sign-in failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  }
  const token = (await res.json()).access_token as string | undefined;
  if (!token) throw new Error('instructor sign-in returned no access_token');
  return token;
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
