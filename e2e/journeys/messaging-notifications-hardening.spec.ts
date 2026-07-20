// ABOUTME: Real-session hardening for course messaging RPC gating and announcement
// ABOUTME: notification fan-out. Uses live signed-in Supabase JWTs to call PostgREST
// ABOUTME: end-to-end and verifies persisted rows, not UI state alone.
import { test, expect } from '@playwright/test';
import { signInMember, getSupabaseAccessToken } from './_helpers/signIn';

const SUPABASE_URL = 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

const COURSE_ID = '660e8400-e29b-41d4-a716-446655440001'; // Intro to Data Science; test user is instructor
const TEST_USER_ID = '66649756-9cfb-4f50-b60e-1f6ac0bf30ff';
const ENROLLED_STUDENT_ID = '71629ac8-ec88-4ce8-a859-9b29a664041d';
const NON_ENROLLED_USER_ID = '30609adf-dc50-4b57-a456-1f38201e40de'; // e2e-instructor, not enrolled in COURSE_ID

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
  return { status: res.status, body: await res.text() };
}

async function passwordSignIn(email: string, password: string): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`sign-in failed for ${email}: ${await r.text()}`);
  return (await r.json()).access_token as string;
}

test.describe('Messaging + notifications — real signed-in RPC gating', () => {
  let instructorToken: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInMember(page);
    const t = await getSupabaseAccessToken(page);
    await ctx.close();
    if (!t) throw new Error('E2E FIXTURE: could not obtain access token for signed-in test user');
    instructorToken = t;
  });

  test('open_course_thread is idempotent: same instructor/student pair returns same conversation UUID', async () => {
    const a = await rpc(instructorToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: ENROLLED_STUDENT_ID,
    });
    expect(a.status, `first call failed: ${a.body}`).toBe(200);
    const idA = JSON.parse(a.body);
    expect(idA).toMatch(/^[0-9a-f-]{36}$/i);

    const b = await rpc(instructorToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: ENROLLED_STUDENT_ID,
    });
    expect(b.status).toBe(200);
    expect(JSON.parse(b.body)).toBe(idA);

    // Caller must at least see their own participant row on the returned conversation.
    const partRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${idA}&user_id=eq.${TEST_USER_ID}&select=user_id`,
      { headers: authHeaders(instructorToken) },
    );
    expect(partRes.status).toBe(200);
    expect((await partRes.json()).length).toBe(1);
  });

  test('instructor -> user not enrolled in the course: RPC rejects with role-gate error', async () => {
    const { status, body } = await rpc(instructorToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: NON_ENROLLED_USER_ID,
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body).toMatch(/not part of this course|enrolled/i);
  });

  test('RPC rejects self-message and invalid course id', async () => {
    const self = await rpc(instructorToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: TEST_USER_ID,
    });
    expect(self.status).toBeGreaterThanOrEqual(400);
    expect(self.body).toMatch(/invalid recipient/i);

    const missing = await rpc(instructorToken, 'open_course_thread', {
      p_course_id: '00000000-0000-0000-0000-000000000000',
      p_other_user_id: ENROLLED_STUDENT_ID,
    });
    expect(missing.status).toBeGreaterThanOrEqual(400);
    expect(missing.body).toMatch(/course not found/i);
  });

  test('student -> other student in same course: RPC rejects (requires E2E_MEMBER_PASSWORD)', async () => {
    const memberEmail = process.env.E2E_MEMBER_EMAIL;
    const memberPassword = process.env.E2E_MEMBER_PASSWORD;
    test.skip(
      !memberEmail || !memberPassword,
      'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — cannot verify student-to-student gate with a real signed-in student session',
    );

    const studentToken = await passwordSignIn(memberEmail!, memberPassword!);
    const { status, body } = await rpc(studentToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: ENROLLED_STUDENT_ID, // another student in this course
    });
    expect(status, `expected rejection, got 2xx with ${body}`).toBeGreaterThanOrEqual(400);
    expect(body).toMatch(/only message the course instructor|must be enrolled/i);
  });

  test('announcement insert fans out real notification rows visible to the enrolled recipient', async () => {
    const memberEmail = process.env.E2E_MEMBER_EMAIL;
    const memberPassword = process.env.E2E_MEMBER_PASSWORD;
    test.skip(
      !memberEmail || !memberPassword,
      'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set — cannot verify cross-user notification RLS visibility',
    );
    // The student must also be enrolled in COURSE_ID for the fan-out row to belong to them.

    const marker = `E2E hardening announcement ${Date.now()}`;
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/course_announcements`, {
      method: 'POST',
      headers: { ...authHeaders(instructorToken), Prefer: 'return=representation' },
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

    // Read notifications AS THE STUDENT — the fan-out row must be visible to them under RLS.
    const studentToken = await passwordSignIn(memberEmail!, memberPassword!);
    const expectedTitle = 'New announcement: ' + marker;
    let studentRows: Array<{ title: string; course_id: string }> = [];
    await expect
      .poll(
        async () => {
          const r = await fetch(
            `${SUPABASE_URL}/rest/v1/notifications?course_id=eq.${COURSE_ID}&title=eq.${encodeURIComponent(
              expectedTitle,
            )}&select=title,course_id`,
            { headers: authHeaders(studentToken) },
          );
          studentRows = (await r.json()) as typeof studentRows;
          return studentRows.length;
        },
        { timeout: 8_000, intervals: [500, 1000, 2000] },
      )
      .toBeGreaterThan(0);

    // Cleanup — delete the probe announcement. Notifications for other users are cleaned by admin OOB if needed.
    await fetch(`${SUPABASE_URL}/rest/v1/course_announcements?id=eq.${announcement.id}`, {
      method: 'DELETE',
      headers: authHeaders(instructorToken),
    });
  });
});
