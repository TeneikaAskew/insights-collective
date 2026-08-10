// ABOUTME: Real-session hardening for course messaging RPC gating and announcement
// ABOUTME: notification fan-out. Uses live signed-in Supabase JWTs to call PostgREST
// ABOUTME: end-to-end and verifies persisted rows, not UI state alone.
import { test, expect } from '../fixtures/page-helpers';
import { signInMember, getSupabaseAccessToken } from './_helpers/signIn';

const SUPABASE_URL = 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

const COURSE_ID = '660e8400-e29b-41d4-a716-446655440001'; // Intro to Data Science; e2e-instructor is instructor_id

/**
 * The announcement probe posts here instead of COURSE_ID.
 *
 * notify_enrolled_on_announcement fans out one notification per ENROLLED user,
 * and COURSE_ID is a published course carrying fifteen enrollments of which
 * thirteen are real and demo accounts. RLS scopes notification DELETE to
 * auth.uid() = user_id, so this spec could only ever clean its own row and left
 * the rest behind on every run — 4,089 of them across 14 inboxes.
 *
 * This course is seeded unpublished with exactly one enrollment, the member who
 * reads the row back, so the blast radius is a test account. Migration
 * 20260810000000 also clears the fan-out when the announcement is deleted; the
 * two together mean neither a missed cleanup nor a crashed run can reach a real
 * inbox. Seeded in e2e/fixtures/seed.sql section 7.
 */
const ANNOUNCEMENT_COURSE_ID = '660e8400-e29b-41d4-a716-4466554409e2';
const TEST_USER_ID = '30609adf-dc50-4b57-a456-1f38201e40de'; // e2e-instructor@insightscollective.org
const ENROLLED_STUDENT_ID = '71629ac8-ec88-4ce8-a859-9b29a664041d'; // david.rodriguez — enrolled, not the signed-in member
const NON_ENROLLED_USER_ID = '891c88ca-cdf5-413c-a0c4-92ee1ef69c87'; // profile with no course role: not enrolled, not instructor

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

  test.beforeAll(async () => {
    // Sign in as the seeded instructor for COURSE_ID (e2e-instructor).
    const email = process.env.E2E_INSTRUCTOR_EMAIL || 'e2e-instructor@insightscollective.org';
    const password = process.env.E2E_INSTRUCTOR_PASSWORD || process.env.E2E_TEST_PASSWORD;
    if (!password) throw new Error('E2E_INSTRUCTOR_PASSWORD or E2E_TEST_PASSWORD required');
    instructorToken = await passwordSignIn(email, password);
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

  test('student -> other student in same course: RPC allows (requires E2E_MEMBER_PASSWORD)', async () => {
    const memberEmail = process.env.E2E_MEMBER_EMAIL || 'e2e-member@insightscollective.org';
    const memberPassword = process.env.E2E_MEMBER_PASSWORD || process.env.E2E_TEST_PASSWORD;
    test.skip(
      !memberEmail || !memberPassword,
      'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD (or E2E_TEST_PASSWORD) not set',
    );

    // This used to assert a rejection: open_course_thread answered student->student
    // with "Students can only message the course instructor". 20260802020300 dropped
    // that hierarchy — membership of the course is now the whole rule — so classmates
    // may talk. The boundary that still matters is tested below and in
    // course-messaging-e2e.spec.ts: someone OUTSIDE the course is still refused, and
    // being allowed to start a thread still gives nobody the right to read another.
    const studentToken = await passwordSignIn(memberEmail!, memberPassword!);
    const { status, body } = await rpc(studentToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: ENROLLED_STUDENT_ID, // another student in this course
    });
    expect(status, `expected the thread to open, got ${status} with ${body}`).toBe(200);
    expect(JSON.parse(body)).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('student -> a user in no shared course: RPC still rejects', async () => {
    const memberPassword2 = process.env.E2E_MEMBER_PASSWORD || process.env.E2E_TEST_PASSWORD;
    test.skip(!memberPassword2, 'E2E_MEMBER_PASSWORD (or E2E_TEST_PASSWORD) not set');

    const studentToken = await passwordSignIn(
      process.env.E2E_MEMBER_EMAIL || 'e2e-member@insightscollective.org',
      memberPassword2!,
    );
    const { status, body } = await rpc(studentToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: NON_ENROLLED_USER_ID,
    });
    expect(status, `expected rejection, got 2xx with ${body}`).toBeGreaterThanOrEqual(400);
    expect(body).toMatch(/not part of this course/i);
  });

  test('announcement insert fans out real notification rows visible to the enrolled recipient', async () => {
    const memberEmail = process.env.E2E_MEMBER_EMAIL || 'e2e-member@insightscollective.org';
    const memberPassword = process.env.E2E_MEMBER_PASSWORD || process.env.E2E_TEST_PASSWORD;
    test.skip(
      !memberEmail || !memberPassword,
      'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD (or E2E_TEST_PASSWORD) not set',
    );
    // The student must be enrolled in ANNOUNCEMENT_COURSE_ID for the fan-out row
    // to belong to them; seed.sql section 7 is what puts them there.

    const marker = `E2E hardening announcement ${Date.now()}`;
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/course_announcements`, {
      method: 'POST',
      headers: { ...authHeaders(instructorToken), Prefer: 'return=representation' },
      body: JSON.stringify({
        course_id: ANNOUNCEMENT_COURSE_ID,
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
            `${SUPABASE_URL}/rest/v1/notifications?course_id=eq.${ANNOUNCEMENT_COURSE_ID}&title=eq.${encodeURIComponent(
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

    // Cleanup — delete the probe announcement, and delete this student's own
    // fan-out notification row (RLS blocks deleting others'). Any residual
    // fan-out rows for other enrolled users are swept in global-setup via
    // SUPABASE_SERVICE_ROLE_KEY when available.
    await fetch(`${SUPABASE_URL}/rest/v1/course_announcements?id=eq.${announcement.id}`, {
      method: 'DELETE',
      headers: authHeaders(instructorToken),
    });
    await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?title=eq.${encodeURIComponent(expectedTitle)}`,
      { method: 'DELETE', headers: authHeaders(studentToken) },
    );
  });
});
