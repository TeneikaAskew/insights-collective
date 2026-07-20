// ABOUTME: End-to-end verification that the course calendar sync UI works.
// ABOUTME: Checks the sidebar sync buttons, downloadable .ics file, and public feed endpoint.

import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';

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

  test('Public feed returns a valid iCalendar response for published course', async ({ request }) => {
    const response = await request.get(feedUrl);
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('text/calendar');

    const body = await response.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('VERSION:2.0');
    expect(body).toContain('END:VCALENDAR');
    expect(body).toContain('SUMMARY');
  });

  test('Feed rejects unpublished or missing courses', async ({ request }) => {
    const missingUrl = `${SUPABASE_URL}/functions/v1/course-calendar-feed?course_id=not-a-real-uuid`;
    const response = await request.get(missingUrl);
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
