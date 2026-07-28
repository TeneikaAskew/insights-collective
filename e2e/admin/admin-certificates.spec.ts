// ABOUTME: E2E for the /admin/courses Certificates tab — proves an admin can
// ABOUTME: actually see and revoke a certificate, against real DB rows.
import { test, expect } from '../fixtures/page-helpers';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const COURSE_TITLE = process.env.E2E_TEST_COURSE_TITLE || 'Introduction to Data Science';
// The certificate e2e/fixtures/seed.sql issues to the member for COURSE_ID.
const SEEDED_CODE = 'E2EMEMBERCERT';

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

  test('the Certificates tab lists the seeded certificate rather than an empty table', async ({ page }) => {
    await page.goto('/admin/courses');

    // Ground truth first, so a seed gap reports as a seed gap instead of
    // masquerading as a UI failure.
    const token = await accessToken(page);
    const res = await page.request.get(
      `${SUPABASE_URL}/rest/v1/certificates?course_id=eq.${COURSE_ID}&verification_code=eq.${SEEDED_CODE}&select=id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } },
    );
    expect(res.ok(), `certificates query ok (${res.status()})`).toBeTruthy();
    expect(
      ((await res.json()) as unknown[]).length,
      `Seed gap: no ${SEEDED_CODE} certificate on ${COURSE_ID}; reseed e2e/fixtures/seed.sql.`,
    ).toBe(1);

    await page.getByRole('tab', { name: /certificates/i }).click();

    // The tab opens on courses[0], and useCoursesManagement orders by
    // created_at DESC — so every newly added course silently becomes the
    // default selection and this panel renders the empty state for it. That is
    // what broke here: the Featured Courses work added a course, the tab
    // defaulted to it, and the assertion below started running against an empty
    // table. Select the seeded course explicitly, as the completion-report spec
    // already does for the same reason.
    const selectTrigger = page.locator('[role="combobox"]').first();
    await selectTrigger.click();
    await page.getByRole('option', { name: new RegExp(`^${COURSE_TITLE}$`, 'i') }).click();
    await expect(selectTrigger).toContainText(COURSE_TITLE);

    // Assert the seeded row is really rendered. The previous version OR-ed
    // "a row" against "no certificates" text, which had two failure modes at
    // once: the empty state renders both a <tr> and a <td> matching that text,
    // so the union resolved to two elements and blew strict mode — and had it
    // resolved to one, an empty table would have satisfied the very assertion
    // meant to catch it. Pin to the code so neither can pass silently.
    await expect(page.getByText(SEEDED_CODE)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/no certificates issued/i)).toHaveCount(0);
  });

  test('revoking a certificate really deletes the row', async ({ page }) => {
    await page.goto('/admin/courses');
    const token = await accessToken(page);
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    const meRes = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers });
    const adminId = (await meRes.json()).id as string;
    const courseId = COURSE_ID;

    // Issue a disposable certificate and revoke that one. Revoking a real
    // member certificate destroyed the row seed.sql issues for the profile
    // specs — /profile then rendered "You haven't earned any certificates yet"
    // and the visual baseline failed on the following run.
    const code = `E2EREVOKE${Date.now().toString(36).toUpperCase()}`;
    const created = await page.request.post(`${SUPABASE_URL}/rest/v1/certificates`, {
      headers,
      data: {
        user_id: adminId,
        course_id: courseId,
        certificate_type: 'completion',
        verification_code: code,
      },
    });
    expect(
      created.ok(),
      `certificate insert (${created.status()}: ${await created.text()}). Staff INSERT policy missing?`,
    ).toBeTruthy();
    const certId = (await created.json())[0].id as string;

    const del = await page.request.delete(
      `${SUPABASE_URL}/rest/v1/certificates?id=eq.${certId}`,
      { headers },
    );
    expect(del.ok(), `revoke request (${del.status()})`).toBeTruthy();

    // A 204 that deleted nothing was the original bug, so the status alone
    // proves nothing — re-read the row.
    const after = await page.request.get(
      `${SUPABASE_URL}/rest/v1/certificates?id=eq.${certId}&select=id`,
      { headers },
    );
    expect(await after.json(), 'certificate row is gone after revoke').toEqual([]);
  });
});
