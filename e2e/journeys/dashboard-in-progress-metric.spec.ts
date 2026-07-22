// ABOUTME: E2E — dashboard "In Progress" tile reflects real content_item_progressions,
// ABOUTME: proving the fix that derives the metric from progressions + certificates instead of enrollments.completion_status.
import { test, expect } from '../fixtures/page-helpers';
import { signInMember, getSupabaseAccessToken } from './_helpers/signIn';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';

test.describe('Dashboard "In Progress" metric', () => {
  test.beforeEach(async ({ page }) => { await signInMember(page); });

  test('reflects a real in-progress course started via content_item_progressions', async ({ page }) => {
    await page.goto('/dashboard');
    const token = await getSupabaseAccessToken(page);
    expect(token, 'session access token').toBeTruthy();
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Resolve the current user's id.
    const meRes = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers });
    expect(meRes.ok(), `auth/v1/user (${meRes.status()})`).toBeTruthy();
    const userId = (await meRes.json()).id as string;
    expect(userId).toBeTruthy();

    // Ensure enrollment exists (RLS: insert allowed for self, updates forbidden).
    const existingEnroll = await page.request.get(
      `${SUPABASE_URL}/rest/v1/enrollments?user_id=eq.${userId}&course_id=eq.${COURSE_ID}&select=id`,
      { headers },
    );
    const enrollRows = existingEnroll.ok() ? await existingEnroll.json() : [];
    if (!enrollRows.length) {
      const enrollRes = await page.request.post(`${SUPABASE_URL}/rest/v1/enrollments`, {
        headers: { ...headers, Prefer: 'return=minimal' },
        data: JSON.stringify({ user_id: userId, course_id: COURSE_ID }),
      });
      expect(enrollRes.ok(), `enrollment insert (${enrollRes.status()}: ${await enrollRes.text()})`).toBeTruthy();
    }

    // Clear any existing certificate so this course counts as in-progress, not completed.
    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/certificates?user_id=eq.${userId}&course_id=eq.${COURSE_ID}`,
      { headers },
    );

    // Grab the first published content item for the seeded course and mark it read.
    const itemsRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/content_items?select=id,modules!inner(course_id,published)&modules.course_id=eq.${COURSE_ID}&modules.published=eq.true&published=eq.true&limit=1`,
      { headers },
    );
    expect(itemsRes.ok(), `content_items (${itemsRes.status()})`).toBeTruthy();
    const items = (await itemsRes.json()) as Array<{ id: string }>;
    expect(items.length, 'seeded course must publish at least one content item').toBeGreaterThan(0);
    const contentItemId = items[0].id;

    const upsertRes = await page.request.post(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?on_conflict=user_id,content_item_id`,
      {
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        data: JSON.stringify({
          user_id: userId,
          content_item_id: contentItemId,
          workflow_state: 'read',
        }),
      },
    );
    expect(upsertRes.ok(), `progression upsert (${upsertRes.status()}: ${await upsertRes.text()})`).toBeTruthy();

    // Now the dashboard tile must show at least 1 in progress (not 0, which was the bug).
    await page.goto('/dashboard');
    const tile = page.getByTestId('metric-in-progress');
    await expect(tile).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => Number((await tile.textContent())?.trim() || '0'), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);
  });
});
