// ABOUTME: Real-session hardening for course messaging RPC gating and announcement
// ABOUTME: notification fan-out. Uses live signed-in Supabase JWT to call PostgREST
// ABOUTME: end-to-end and verifies persisted rows, not UI state alone.
import { test, expect } from '@playwright/test';
import { signInMember, getSupabaseAccessToken } from './_helpers/signIn';

const SUPABASE_URL = 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

const COURSE_ID = '660e8400-e29b-41d4-a716-446655440001'; // Intro to Data Science; test user is instructor
const TEST_USER_ID = '66649756-9cfb-4f50-b60e-1f6ac0bf30ff';
const ENROLLED_STUDENT_ID = '71629ac8-ec88-4ce8-a859-9b29a664041d';
const NON_ENROLLED_USER_ID = '30609adf-dc50-4b57-a456-1f38201e40de'; // e2e-instructor, not enrolled in this course

function authHeaders(token: string) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function rpc(token: string, name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

test.describe('Messaging + notifications — real signed-in RPC gating', () => {
  let token: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInMember(page);
    const t = await getSupabaseAccessToken(page);
    await ctx.close();
    if (!t) throw new Error('E2E FIXTURE: could not obtain access token for signed-in test user');
    token = t;
  });

  test('instructor -> enrolled student: RPC returns conversation UUID', async () => {
    const { status, body } = await rpc(token, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: ENROLLED_STUDENT_ID,
    });
    expect(status, `open_course_thread failed: ${body}`).toBe(200);
    const parsed = JSON.parse(body);
    expect(typeof parsed).toBe('string');
    expect(parsed).toMatch(/^[0-9a-f-]{36}$/i);

    // Verify persisted participants — the returned conversation must contain BOTH users.
    const conv = await fetch(
      `${SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${parsed}&select=user_id`,
      { headers: authHeaders(token) },
    );
    const rows = (await conv.json()) as Array<{ user_id: string }>;
    const ids = rows.map((r) => r.user_id).sort();
    expect(ids).toEqual([TEST_USER_ID, ENROLLED_STUDENT_ID].sort());
  });

  test('instructor -> non-enrolled recipient: RPC rejects with role-gate error', async () => {
    const { status, body } = await rpc(token, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: NON_ENROLLED_USER_ID,
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body).toMatch(/not part of this course|enrolled/i);
  });

  test('caller not enrolled/instructor of a course: RPC rejects', async () => {
    // Course 002 — test user is neither instructor nor enrolled
    const { status, body } = await rpc(token, 'open_course_thread', {
      p_course_id: '660e8400-e29b-41d4-a716-446655440002',
      p_other_user_id: NON_ENROLLED_USER_ID,
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body).toMatch(/must be enrolled|only message the course instructor/i);
  });

  test('student -> other student in same course: RPC rejects (requires E2E_MEMBER_PASSWORD)', async ({
    browser,
  }, testInfo) => {
    const memberEmail = process.env.E2E_MEMBER_EMAIL;
    const memberPassword = process.env.E2E_MEMBER_PASSWORD;
    test.skip(
      !memberEmail || !memberPassword,
      'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — cannot verify student-to-student gate with a real signed-in student session',
    );

    // Sign the student in via password grant (they must be an enrolled student of COURSE_ID, not an instructor)
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON },
      body: JSON.stringify({ email: memberEmail, password: memberPassword }),
    });
    expect(authRes.ok, `sign-in failed for ${memberEmail}`).toBeTruthy();
    const studentToken = (await authRes.json()).access_token as string;

    const { status, body } = await rpc(studentToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: ENROLLED_STUDENT_ID, // another student in this course
    });
    expect(status, `expected rejection, got 2xx with ${body}`).toBeGreaterThanOrEqual(400);
    expect(body).toMatch(/only message the course instructor/i);
  });

  test('announcement insert fans out real notification rows to enrolled students', async () => {
    const marker = `E2E hardening announcement ${Date.now()}`;

    // Insert as instructor (test user is instructor of COURSE_ID → passes RLS WITH CHECK)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/course_announcements`, {
      method: 'POST',
      headers: { ...authHeaders(token), Prefer: 'return=representation' },
      body: JSON.stringify({
        course_id: COURSE_ID,
        title: marker,
        content: 'End-to-end hardening probe. Safe to delete.',
        created_by: TEST_USER_ID,
        author_id: TEST_USER_ID,
      }),
    });
    const insertBody = await insertRes.text();
    expect(insertRes.status, `announcement insert failed: ${insertBody}`).toBe(201);
    const [announcement] = JSON.parse(insertBody) as Array<{ id: string }>;

    // Poll the notifications table (as instructor — RLS allows admins/instructors of the course to read fan-out rows)
    let notifRows: Array<{ user_id: string; title: string; course_id: string }> = [];
    await expect
      .poll(
        async () => {
          const r = await fetch(
            `${SUPABASE_URL}/rest/v1/notifications?course_id=eq.${COURSE_ID}&title=eq.${encodeURIComponent(
              'New announcement: ' + marker,
            )}&select=user_id,title,course_id`,
            { headers: authHeaders(token) },
          );
          notifRows = (await r.json()) as typeof notifRows;
          return notifRows.length;
        },
        { timeout: 8_000, intervals: [500, 1000, 2000] },
      )
      .toBeGreaterThan(0);

    // The known enrolled student must be one of the fan-out targets.
    const recipients = new Set(notifRows.map((n) => n.user_id));
    expect(recipients.has(ENROLLED_STUDENT_ID)).toBe(true);

    // Cleanup — delete our probe announcement (cascade would leave notifications; explicit delete too)
    await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?course_id=eq.${COURSE_ID}&title=eq.${encodeURIComponent(
        'New announcement: ' + marker,
      )}`,
      { method: 'DELETE', headers: authHeaders(token) },
    );
    await fetch(`${SUPABASE_URL}/rest/v1/course_announcements?id=eq.${announcement.id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  });
});
