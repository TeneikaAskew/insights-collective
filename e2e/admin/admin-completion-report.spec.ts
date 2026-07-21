// ABOUTME: E2E — verifies the admin completion-report CSV export matches actual enrollment progress in Supabase.
// ABOUTME: Loads /admin/courses → Enrollments, downloads the CSV, and diffs it against live enrollments data.
import { test, expect } from '../fixtures/page-helpers';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';
const COURSE_ID = process.env.E2E_TEST_ADMIN_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const COURSE_TITLE = process.env.E2E_TEST_COURSE_TITLE || 'Introduction to Data Science';

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cur.push(field); field = ''; }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else field += ch;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

test.describe('Admin — completion report export', () => {
  test('CSV export matches real enrollment progress for the seeded course', async ({ page }) => {
    await page.goto('/admin/courses');
    await page.getByRole('tab', { name: /enrollments/i }).click();

    // Pick the seeded course from the course selector
    const selectTrigger = page.locator('[role="combobox"]').first();
    await selectTrigger.click();
    await page.getByRole('option', { name: new RegExp(COURSE_TITLE, 'i') }).click();

    // Wait for the enrollments table to render at least one row (or "No enrollments")
    await expect(
      page.getByText(/Total Enrollments/i).or(page.getByText(/No enrollments found/i)),
    ).toBeVisible({ timeout: 15_000 });

    const downloadBtn = page.getByTestId('download-completion-report');
    await expect(downloadBtn).toBeVisible();

    // Trigger the download and capture the file
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click(),
    ]);
    const path = await download.path();
    expect(path, 'download saved to disk').toBeTruthy();
    const fs = await import('fs');
    const csv = fs.readFileSync(path!, 'utf-8');
    const rows = parseCsv(csv).filter((r) => r.some((c) => c !== ''));

    // Header must match
    expect(rows[0]).toEqual(['Student Name', 'Enrolled Date', 'Completion %', 'Status']);

    // Compare against ground truth from Supabase REST (respects RLS via admin session token)
    const accessToken: string | null = await page.evaluate(async () => {
      const readToken = (raw: string | null) => {
        if (!raw) return null;
        try {
          const p = JSON.parse(raw) as any;
          return p?.access_token ?? p?.currentSession?.access_token ?? (Array.isArray(p) ? p[0] : null);
        } catch { return null; }
      };
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if ((k.startsWith('sb-') && k.endsWith('-auth-token')) || k === 'supabase.auth.token') {
          const t = readToken(localStorage.getItem(k));
          if (t) return t;
        }
      }
      return null;
    });
    expect(accessToken, 'admin session access token present').toBeTruthy();

    const res = await page.request.get(
      `${SUPABASE_URL}/rest/v1/enrollments?course_id=eq.${COURSE_ID}&select=user_id,completion_status,enrolled_at`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` } },
    );
    expect(res.ok(), `enrollments query ok (${res.status()})`).toBeTruthy();
    const dbRows = (await res.json()) as Array<{ user_id: string; completion_status: number | null }>;

    // CSV row count (excluding header) must equal number of DB enrollments
    expect(rows.length - 1).toBe(dbRows.length);

    // Every CSV completion % must appear in the DB set — proves numbers weren't fabricated
    const dbPercents = dbRows.map((r) => String(r.completion_status ?? 0)).sort();
    const csvPercents = rows.slice(1).map((r) => r[2]).sort();
    expect(csvPercents).toEqual(dbPercents);

    // Status column must derive correctly from the percentage
    for (const r of rows.slice(1)) {
      const pct = Number(r[2]);
      const expected = pct >= 100 ? 'Completed' : pct > 0 ? 'In Progress' : 'Not Started';
      expect(r[3]).toBe(expected);
    }
  });
});
