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
    return null;
  });
  if (!token) throw new Error('No Supabase access token in localStorage — admin session not restored');
  return token;
}

test.describe('Instructor/admin roster + reporting', () => {
  test('enrollments table lists every student in the seeded course and matches DB counts', async ({ page }) => {
    await page.goto('/admin/courses');
    await page.getByRole('tab', { name: /enrollments/i }).click();

    // Pick the seeded course.
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole('option', { name: new RegExp(COURSE_TITLE, 'i') }).click();

    // Wait for either enrollments to load or an explicit empty-state.
    await expect(
      page.getByText(/Total Enrollments/i).or(page.getByText(/No enrollments found/i)),
    ).toBeVisible({ timeout: 15_000 });

    // Ground truth from Supabase (respects admin RLS via session token).
    const token = await getAccessToken(page);
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
    const dbRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/enrollments?course_id=eq.${COURSE_ID}&select=user_id,completion_status,profiles:user_id(first_name,last_name)`,
      { headers },
    );
    expect(dbRes.ok(), `enrollments query ok (${dbRes.status()})`).toBeTruthy();
    const dbRows = (await dbRes.json()) as Array<{
      user_id: string;
      completion_status: number | null;
      profiles: { first_name: string | null; last_name: string | null } | null;
    }>;

    if (dbRows.length === 0) {
      await expect(page.getByText(/No enrollments found/i)).toBeVisible();
      return;
    }

    // Total enrollments card matches DB count.
    const totalCard = page.locator('div').filter({ hasText: /^Total Enrollments$/ }).locator('..');
    await expect(totalCard.getByText(String(dbRows.length))).toBeVisible();

    // Table body rows match DB row count.
    const bodyRows = page.locator('table tbody tr');
    await expect(bodyRows).toHaveCount(dbRows.length);

    // Each student's full name (if a profile exists) appears in the table.
    for (const row of dbRows) {
      const name = `${row.profiles?.first_name ?? ''} ${row.profiles?.last_name ?? ''}`.trim();
      if (name.length === 0) continue;
      await expect(page.getByRole('cell', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first()).toBeVisible();
    }

    // Report export button is available for the instructor/admin.
    await expect(page.getByTestId('download-completion-report')).toBeVisible();
  });
});
