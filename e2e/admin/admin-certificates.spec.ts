// ABOUTME: E2E for the /admin/courses Certificates tab — proves an admin can
// ABOUTME: actually see and revoke a certificate, against real DB rows.
import { test, expect } from '../fixtures/page-helpers';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

async function accessToken(page: import('@playwright/test').Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if ((k.startsWith('sb-') && k.endsWith('-auth-token')) || k === 'supabase.auth.token') {
        try {
          const p = JSON.parse(localStorage.getItem(k)!) as any;
          const t = p?.access_token ?? p?.currentSession?.access_token ?? (Array.isArray(p) ? p[0] : null);
          if (t) return t as string;
        } catch { /* ignore malformed entries */ }
      }
    }
    return null;
  });
  expect(token, 'admin session access token').toBeTruthy();
  return token as string;
}

test.describe('Admin — certificates', () => {
  /**
   * certificates carried only owner-scoped RLS (auth.uid() = user_id), so an
   * admin's list came back empty and Revoke deleted nothing while PostgREST
   * still answered 204 — the UI removed the row and reported success anyway.
   * This asserts staff really can read the table.
   */
  test('an admin can read certificates issued to other users', async ({ page }) => {
    await page.goto('/admin/courses');
    const token = await accessToken(page);
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };

    const meRes = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers });
    expect(meRes.ok()).toBeTruthy();
    const adminId = (await meRes.json()).id as string;

    const res = await page.request.get(
      `${SUPABASE_URL}/rest/v1/certificates?select=id,user_id,course_id&limit=200`,
      { headers },
    );
    expect(res.ok(), `certificates readable by admin (${res.status()})`).toBeTruthy();
    const rows = (await res.json()) as Array<{ id: string; user_id: string; course_id: string }>;
    expect(
      rows.length,
      'Seed gap: no certificates exist at all, so admin visibility cannot be verified.',
    ).toBeGreaterThan(0);
    expect(
      rows.some((r) => r.user_id !== adminId),
      "Admin only sees their own certificates — the staff SELECT policy on public.certificates isn't in effect.",
    ).toBe(true);
  });

  test('the Certificates tab lists rows rather than a permanently empty table', async ({ page }) => {
    await page.goto('/admin/courses');
    await page.getByRole('tab', { name: /certificates/i }).click();

    // Either real certificate rows or an explicit empty state — never a
    // silently blank panel.
    await expect(
      page.locator('table tbody tr').first().or(page.getByText(/no certificates/i)),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('revoking a certificate really deletes the row', async ({ page }) => {
    await page.goto('/admin/courses');
    const token = await accessToken(page);
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const meRes = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers });
    const adminId = (await meRes.json()).id as string;

    // Certificates are issued server-side (there is deliberately no client
    // INSERT policy), so revoke one belonging to another test account rather
    // than minting one. certificate-generation.spec.ts re-issues the member's
    // certificate for the seeded course, so this row is reproducible.
    const courseId = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
    const listRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/certificates?course_id=eq.${courseId}&select=id,user_id`,
      { headers },
    );
    expect(listRes.ok(), `certificates readable (${listRes.status()})`).toBeTruthy();
    const others = ((await listRes.json()) as Array<{ id: string; user_id: string }>).filter(
      (c) => c.user_id !== adminId,
    );
    expect(
      others.length,
      'Seed gap: no certificate issued to another user for the seeded course. Run e2e/journeys/certificate-generation.spec.ts first.',
    ).toBeGreaterThan(0);
    const target = others[0];

    const del = await page.request.delete(
      `${SUPABASE_URL}/rest/v1/certificates?id=eq.${target.id}`,
      { headers },
    );
    expect(del.ok(), `revoke request (${del.status()})`).toBeTruthy();

    // The bug was a 204 that deleted nothing, so the status alone proves
    // nothing — re-read the row.
    const after = await page.request.get(
      `${SUPABASE_URL}/rest/v1/certificates?id=eq.${target.id}&select=id`,
      { headers },
    );
    expect(await after.json(), "admin's revoke removed another user's certificate").toEqual([]);
  });
});
