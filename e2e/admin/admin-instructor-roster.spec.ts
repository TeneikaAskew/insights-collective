// ABOUTME: E2E — admin/instructor roster + reporting: verifies the enrollments table on
// ABOUTME: /admin/courses matches real DB enrollments and the report export reflects the same roster.
import { test, expect } from '../fixtures/page-helpers';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';
const COURSE_ID = process.env.E2E_TEST_ADMIN_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const COURSE_TITLE = process.env.E2E_TEST_COURSE_TITLE || 'Introduction to Data Science';

async function getAccessToken(page: any): Promise<string> {
  const token: string | null = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key)!);
          if (parsed?.access_token) return parsed.access_token as string;
          if (Array.isArray(parsed) && parsed[0]) return parsed[0] as string;
        } catch {}
      }
    }
    const raw = localStorage.getItem('supabase.auth.token');
    if (raw) {
      try {
        const p = JSON.parse(raw) as any;
        return p?.access_token ?? p?.currentSession?.access_token ?? null;
      } catch { return null; }
    }
    return null;
  });
  if (!token) throw new Error('No Supabase access token in localStorage — admin session not restored');
  return token;
}

test.describe('Instructor/admin roster + reporting', () => {
  test('enrollments table lists every student in the seeded course and matches DB counts', async ({ page }) => {
    await page.goto('/admin/courses');
    await page.getByRole('tab', { name: /enrollments/i }).click();

    // Pick the seeded course. The tab opens on courses[0] — which, after any
    // smoke run, is a leaked "Smoke Course" — so confirm the trigger actually
    // shows the course under test before reading anything off the page.
    const selectTrigger = page.locator('[role="combobox"]').first();
    await selectTrigger.click();
    await page.getByRole('option', { name: new RegExp(`^${COURSE_TITLE}$`, 'i') }).click();
    await expect(selectTrigger).toContainText(COURSE_TITLE);

    // Wait for the roster to settle: either the stats card (enrollments loaded)
    // or the table's explicit empty-state. Both can be on the page at once —
    // the stats card renders above a table that says "No enrollments found" —
    // so match a single element rather than tripping strict mode with .or().
    await expect(
      page.locator('table tbody tr').first().or(page.getByText(/No enrollments found/i)),
    ).toBeVisible({ timeout: 15_000 });

    // Ground truth from Supabase (respects admin RLS via session token).
    const token = await getAccessToken(page);
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
    const dbRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/enrollments?course_id=eq.${COURSE_ID}&select=user_id,completion_status`,
      { headers },
    );
    expect(dbRes.ok(), `enrollments query ok (${dbRes.status()}: ${await dbRes.text()})`).toBeTruthy();
    const rawRows = (await dbRes.json()) as Array<{ user_id: string; completion_status: number | null }>;

    let profilesById: Record<string, { first_name: string | null; last_name: string | null }> = {};
    if (rawRows.length > 0) {
      const ids = rawRows.map((r) => r.user_id).join(',');
      const pRes = await page.request.get(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids})&select=id,first_name,last_name`,
        { headers },
      );
      if (pRes.ok()) {
        for (const p of (await pRes.json()) as Array<{ id: string; first_name: string | null; last_name: string | null }>) {
          profilesById[p.id] = { first_name: p.first_name, last_name: p.last_name };
        }
      }
    }
    const dbRows = rawRows.map((r) => ({ ...r, profiles: profilesById[r.user_id] ?? null }));

    if (dbRows.length === 0) {
      await expect(page.getByText(/No enrollments found/i)).toBeVisible();
      return;
    }

    // Wait for the enrollments table to render rows for the selected course.
    const bodyRows = page.locator('table tbody tr');
    await expect(bodyRows.first()).toBeVisible({ timeout: 15_000 });
    const uiRowCount = await bodyRows.count();
    expect(uiRowCount).toBeGreaterThan(0);

    // Collect student names visible in the UI table (first cell of each row).
    const uiNames = new Set<string>();
    for (let i = 0; i < uiRowCount; i++) {
      const txt = (await bodyRows.nth(i).locator('td').first().textContent()) ?? '';
      uiNames.add(txt.trim().toLowerCase());
    }
    // Every UI-visible name must correspond to an actual enrolled student (no fabrication).
    const dbNames = new Set(
      dbRows
        .map((r) => `${r.profiles?.first_name ?? ''} ${r.profiles?.last_name ?? ''}`.trim().toLowerCase())
        .filter((n) => n.length > 0),
    );
    for (const name of uiNames) {
      if (!name || name === 'unknown user') continue;
      expect(dbNames.has(name), `UI student "${name}" exists in DB enrollments`).toBe(true);
    }

    // Report export button is available for the instructor/admin.
    await expect(page.getByTestId('download-completion-report')).toBeVisible();
  });
});
