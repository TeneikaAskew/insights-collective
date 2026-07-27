// ABOUTME: End-to-end verification that the course calendar sync UI works.
// ABOUTME: Checks the sidebar sync buttons, downloadable .ics file, and public feed endpoint.

import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { getSupabaseAccessToken } from '../journeys/_helpers/signIn';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

const feedUrl = `${SUPABASE_URL}/functions/v1/course-calendar-feed?course_id=${encodeURIComponent(COURSE_ID)}`;

test.describe('Course calendar sync', () => {
  test('Course detail sidebar shows calendar sync options', async ({ page }) => {
    await goto(page, `/courses/${COURSE_ID}`);
    await expect(page.getByRole('heading', { name: /Introduction to Data Science/i }).first()).toBeVisible();

    const syncHeading = page.getByText(/Sync calendar/i);
    await expect(syncHeading).toBeVisible();

    await expect(page.getByRole('button', { name: /Download .ics file/i })).toBeVisible();
    await expect(page.getByText(/Add to Google Calendar/i)).toBeVisible();
    await expect(page.getByText(/Subscribe with Apple Calendar/i)).toBeVisible();
    await expect(page.getByText(/Copy feed URL/i)).toBeVisible();
  });

  // The feed used to be readable by anyone who knew a published course id, which
  // leaked the whole schedule including verbatim announcement bodies. It now
  // requires a per-enrollment token in the URL (a calendar client cannot send a
  // JWT), so these assert the token contract rather than open access.

  test('Feed refuses to serve without a per-enrollment token', async ({ request }) => {
    const response = await request.get(feedUrl);
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toMatch(/token/i);
  });

  test('Feed does not reveal whether a course exists to a tokenless caller', async ({ request }) => {
    const missingUrl = `${SUPABASE_URL}/functions/v1/course-calendar-feed?course_id=not-a-real-uuid`;
    const response = await request.get(missingUrl);
    // Same 401 as the real course above: no existence oracle before auth.
    expect(response.status()).toBe(401);
  });

  test('Enrolled member gets a valid iCalendar feed with their token', async ({ page, request }) => {
    await goto(page, `/courses/${COURSE_ID}`);
    const jwt = await getSupabaseAccessToken(page);
    expect(jwt, 'member Supabase session token').toBeTruthy();

    // Owners read their token through a SECURITY DEFINER RPC; the column itself
    // is not selectable, so this is the only way a client can obtain it.
    const rpc = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_my_calendar_feed_token`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      data: { p_course_id: COURSE_ID },
    });
    expect(rpc.status(), 'get_my_calendar_feed_token').toBe(200);
    const feedToken = (await rpc.json()) as string | null;
    expect(feedToken, 'Seed gap: member must be enrolled in the seeded course to have a feed token').toBeTruthy();

    const response = await request.get(`${feedUrl}&token=${encodeURIComponent(feedToken!)}`);
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('text/calendar');

    const body = await response.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('VERSION:2.0');
    expect(body).toContain('END:VCALENDAR');
    expect(body).toContain('SUMMARY');
  });

  test('A valid token does not unlock other courses', async ({ page, request }) => {
    await goto(page, `/courses/${COURSE_ID}`);
    const jwt = await getSupabaseAccessToken(page);
    expect(jwt, 'member Supabase session token').toBeTruthy();

    const rpc = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_my_calendar_feed_token`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      data: { p_course_id: COURSE_ID },
    });
    const feedToken = (await rpc.json()) as string | null;
    expect(feedToken).toBeTruthy();

    // The token is scoped to one enrollment: replaying it against a different
    // course id resolves to no subscriber and 404s.
    const otherCourse = '00000000-0000-4000-8000-000000000001';
    const response = await request.get(
      `${SUPABASE_URL}/functions/v1/course-calendar-feed?course_id=${otherCourse}&token=${encodeURIComponent(feedToken!)}`,
    );
    expect(response.status()).toBe(404);
  });

  test('Download .ics button generates a calendar file', async ({ page, context }) => {
    await goto(page, `/courses/${COURSE_ID}`);
    await expect(page.getByRole('heading', { name: /Introduction to Data Science/i }).first()).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download .ics file/i }).click(),
    ]);

    const path = await download.path();
    expect(path).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/\.ics$/);
  });
});
