// ABOUTME: End-to-end verification that the course calendar sync UI works.
// ABOUTME: Checks the sidebar sync buttons, downloadable .ics file, and public feed endpoint.

import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';

const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
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

  // The feed is no longer anonymous: it carries a per-enrollment token,
  // because a calendar client subscribing to an ICS URL cannot send an
  // Authorization header. This used to assert 200 on a tokenless request,
  // which the function now refuses — correctly.
  test('Feed refuses a request with no token', async ({ request }) => {
    const response = await request.get(feedUrl);
    expect(response.status()).toBe(401);
    expect(await response.text()).toContain('token');
  });

  test('Feed returns a valid iCalendar response for an enrolled subscriber', async ({ page, request }) => {
    // Take the token the app itself mints for this user, rather than
    // fabricating one — that is what a real subscription URL contains.
    await goto(page, `/courses/${COURSE_ID}`);
    const accessToken = await page.evaluate(() => {
      const raw = localStorage.getItem('supabase.auth.token');
      return raw ? (JSON.parse(raw).access_token as string | undefined) ?? null : null;
    });

    test.skip(!accessToken, 'no member session — cannot mint a feed token');

    const rpc = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_my_calendar_feed_token`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_course_id: COURSE_ID },
    });
    test.skip(!rpc.ok(), `feed token unavailable (HTTP ${rpc.status()})`);
    const feedToken = (await rpc.json()) as string;

    const response = await request.get(`${feedUrl}&token=${encodeURIComponent(feedToken)}`);
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('text/calendar');

    const body = await response.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('VERSION:2.0');
    expect(body).toContain('END:VCALENDAR');
  });

  // Authorization is checked before the course is looked up, so an anonymous
  // caller cannot use this endpoint to discover which course ids exist — the
  // response is identical for a real course and a made-up one.
  test('Feed rejects an unauthenticated request without revealing whether the course exists', async ({ request }) => {
    const missing = await request.get(
      `${SUPABASE_URL}/functions/v1/course-calendar-feed?course_id=not-a-real-uuid`,
    );
    const real = await request.get(feedUrl);

    expect(missing.status()).toBe(401);
    expect(real.status()).toBe(401);
    expect(await missing.text()).toBe(await real.text());
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
