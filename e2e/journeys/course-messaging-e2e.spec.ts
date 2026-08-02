// ABOUTME: The whole messaging round trip against the live system with real signed-in JWTs:
// ABOUTME: send, receive, mark-as-read, and the isolation between one thread and the next.
//
// This is the spec that answers "does messaging actually work, and can people read each
// other's mail". It does not drive the UI, deliberately — every claim here is about what
// the *database and Edge Function* allow, which is the layer that decides whether a
// message is private. A UI test can only show that a screen did not render something.
//
// Companion to messaging-notifications-hardening.spec.ts, which covers who is allowed to
// open a thread. This one picks up after the thread exists.

import { test, expect } from '../fixtures/page-helpers';

const SUPABASE_URL = 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

const COURSE_ID = '660e8400-e29b-41d4-a716-446655440001'; // Intro to Data Science
const INSTRUCTOR_ID = '30609adf-dc50-4b57-a456-1f38201e40de'; // e2e-instructor, teaches COURSE_ID
const MEMBER_ID = '575f018c-fa13-4e36-959f-7aba223b1e53'; // e2e-member, enrolled in COURSE_ID
const OTHER_STUDENT_ID = '71629ac8-ec88-4ce8-a859-9b29a664041d'; // david.rodriguez, also enrolled
const NO_SHARED_COURSE_ID = '891c88ca-cdf5-413c-a0c4-92ee1ef69c87'; // no course role anywhere
const PROBE_SUBJECT = 'E2E directory DM probe';

function authHeaders(token: string) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
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

async function rpc(token: string, name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text() };
}

async function rest(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init.headers as Record<string, string> | undefined) },
  });
  return { status: res.status, body: await res.text() };
}

/** The production send path: the client never inserts into `messages` itself. */
async function sendViaEdgeFunction(token: string, conversationId: string, content: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/messages-helper`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ action: 'sendMessage', conversationId, content }),
  });
  return { status: res.status, body: await res.text() };
}

const memberEmail = process.env.E2E_MEMBER_EMAIL || 'e2e-member@insightscollective.org';
const memberPassword = process.env.E2E_MEMBER_PASSWORD || process.env.E2E_TEST_PASSWORD;
const instructorEmail = process.env.E2E_INSTRUCTOR_EMAIL || 'e2e-instructor@insightscollective.org';
const instructorPassword = process.env.E2E_INSTRUCTOR_PASSWORD || process.env.E2E_TEST_PASSWORD;

test.describe('Course messaging — end to end', () => {
  let instructorToken: string;
  let studentToken: string;

  test.skip(
    !memberPassword || !instructorPassword,
    'needs E2E_MEMBER_PASSWORD and E2E_INSTRUCTOR_PASSWORD (or E2E_TEST_PASSWORD)',
  );

  test.beforeAll(async () => {
    instructorToken = await passwordSignIn(instructorEmail, instructorPassword!);
    studentToken = await passwordSignIn(memberEmail, memberPassword!);
  });

  test('a student and their instructor can hold a conversation, and it is marked read', async () => {
    // 1. Student opens the course thread with their instructor.
    const opened = await rpc(studentToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: INSTRUCTOR_ID,
    });
    expect(opened.status, `open_course_thread failed: ${opened.body}`).toBe(200);
    const conversationId = JSON.parse(opened.body) as string;
    expect(conversationId).toMatch(/^[0-9a-f-]{36}$/i);

    const marker = `E2E student probe ${Date.now()}`;
    const reply = `E2E instructor reply ${Date.now()}`;

    // 2. Student sends. Through the Edge Function, which is what the app calls.
    const sent = await sendViaEdgeFunction(studentToken, conversationId, marker);
    expect(sent.status, `student send failed: ${sent.body}`).toBe(200);

    // 3. The instructor RECEIVES it — read back under the instructor's own RLS, which is
    //    the same query useConversationMessages runs.
    const received = await rest(
      instructorToken,
      `messages?conversation_id=eq.${conversationId}&select=id,content,read,sender_id`,
    );
    expect(received.status).toBe(200);
    const instructorView = JSON.parse(received.body) as Array<{
      id: string; content: string; read: boolean; sender_id: string;
    }>;
    const delivered = instructorView.find((m) => m.content === marker);
    expect(delivered, `instructor did not receive the student's message`).toBeTruthy();
    expect(delivered!.sender_id).toBe(MEMBER_ID);

    // 4. Instructor replies; the student receives that.
    const repliedRes = await sendViaEdgeFunction(instructorToken, conversationId, reply);
    expect(repliedRes.status, `instructor reply failed: ${repliedRes.body}`).toBe(200);

    const studentView = await rest(
      studentToken,
      `messages?conversation_id=eq.${conversationId}&select=id,content,read,sender_id`,
    );
    expect(studentView.status).toBe(200);
    const studentMessages = JSON.parse(studentView.body) as Array<{
      id: string; content: string; read: boolean; sender_id: string;
    }>;
    expect(studentMessages.some((m) => m.content === reply)).toBe(true);

    // 5. Marking read has to actually change a row.
    //
    //    This is a regression guard with real history: the client used to do
    //    `update messages set read = true where sender_id <> me`, and the only UPDATE
    //    policy on `messages` is `sender_id = auth.uid()`. It matched nothing, returned
    //    no error, and every received message stayed visibly unread forever.
    //    mark_conversation_read is a SECURITY DEFINER RPC that checks membership and
    //    reports how many rows it touched, so "it silently did nothing" is now a
    //    failing assertion rather than an invisible bug.
    const marked = await rpc(studentToken, 'mark_conversation_read', {
      p_conversation_id: conversationId,
    });
    expect(marked.status, `mark_conversation_read failed: ${marked.body}`).toBe(200);
    expect(Number(JSON.parse(marked.body))).toBeGreaterThan(0);

    const afterMark = await rest(
      studentToken,
      `messages?conversation_id=eq.${conversationId}&sender_id=eq.${INSTRUCTOR_ID}&select=read`,
    );
    const instructorMessages = JSON.parse(afterMark.body) as Array<{ read: boolean }>;
    expect(instructorMessages.length).toBeGreaterThan(0);
    expect(instructorMessages.every((m) => m.read)).toBe(true);

    // 6. Marking read must not touch your own messages — "read" means the other side
    //    read it, so flagging your own would make the sender's receipt meaningless.
    const ownAfterMark = await rest(
      studentToken,
      `messages?conversation_id=eq.${conversationId}&content=eq.${encodeURIComponent(marker)}&select=read`,
    );
    const own = JSON.parse(ownAfterMark.body) as Array<{ read: boolean }>;
    expect(own.length).toBe(1);

    // Cleanup: each sender deletes their own probe (messages_delete_own).
    await rest(studentToken, `messages?content=eq.${encodeURIComponent(marker)}`, { method: 'DELETE' });
    await rest(instructorToken, `messages?content=eq.${encodeURIComponent(reply)}`, { method: 'DELETE' });
  });

  test('a classmate cannot read, join, or post into a thread they are not in', async () => {
    // A thread between the instructor and a DIFFERENT enrolled student. The acting
    // student below is in the same course — so this is not "an outsider is locked out of
    // the course", it is the narrower and more important claim: being in the course does
    // not let you read somebody else's conversation about it.
    const opened = await rpc(instructorToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: OTHER_STUDENT_ID,
    });
    expect(opened.status, `open_course_thread failed: ${opened.body}`).toBe(200);
    const privateThread = JSON.parse(opened.body) as string;

    const secret = `E2E private probe ${Date.now()}`;
    const sent = await sendViaEdgeFunction(instructorToken, privateThread, secret);
    expect(sent.status, `instructor send failed: ${sent.body}`).toBe(200);

    // Cannot read the messages.
    const peek = await rest(
      studentToken,
      `messages?conversation_id=eq.${privateThread}&select=id,content`,
    );
    expect(peek.status).toBe(200);
    expect(JSON.parse(peek.body)).toEqual([]);

    // Cannot even see that the conversation exists.
    const peekConversation = await rest(
      studentToken,
      `conversations?id=eq.${privateThread}&select=id,subject`,
    );
    expect(peekConversation.status).toBe(200);
    expect(JSON.parse(peekConversation.body)).toEqual([]);

    // Cannot post into it — not through PostgREST...
    const intrude = await rest(studentToken, 'messages', {
      method: 'POST',
      body: JSON.stringify({
        sender_id: MEMBER_ID,
        conversation_id: privateThread,
        content: 'E2E intruder probe',
      }),
    });
    expect(intrude.status, `expected rejection, got ${intrude.status}: ${intrude.body}`)
      .toBeGreaterThanOrEqual(400);

    // ...and not through the Edge Function, which runs as the service role and so has to
    // do the membership check itself.
    const intrudeViaFunction = await sendViaEdgeFunction(
      studentToken,
      privateThread,
      'E2E intruder probe via function',
    );
    expect(
      intrudeViaFunction.status,
      `expected rejection, got ${intrudeViaFunction.status}: ${intrudeViaFunction.body}`,
    ).toBeGreaterThanOrEqual(400);
    expect(intrudeViaFunction.body).toMatch(/not a participant/i);

    // Cannot mark somebody else's thread as read.
    const markOther = await rpc(studentToken, 'mark_conversation_read', {
      p_conversation_id: privateThread,
    });
    expect(markOther.status).toBeGreaterThanOrEqual(400);
    expect(markOther.body).toMatch(/not a participant/i);

    // Cannot add themselves to it.
    const join = await rest(studentToken, 'conversation_participants', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: privateThread, user_id: MEMBER_ID }),
    });
    expect(join.status, `expected rejection, got ${join.status}: ${join.body}`)
      .toBeGreaterThanOrEqual(400);

    // The thread is still exactly what the instructor sent — nothing leaked in.
    const instructorView = await rest(
      instructorToken,
      `messages?conversation_id=eq.${privateThread}&select=content`,
    );
    const contents = (JSON.parse(instructorView.body) as Array<{ content: string }>).map((m) => m.content);
    expect(contents).toContain(secret);
    expect(contents).not.toContain('E2E intruder probe');
    expect(contents).not.toContain('E2E intruder probe via function');

    await rest(instructorToken, `messages?content=eq.${encodeURIComponent(secret)}`, { method: 'DELETE' });
  });

  test('a conversation still cannot be created outside a course', async () => {
    // The old "New Conversation" dialog opened a thread with anyone in the directory.
    // That is still refused — but the boundary is now the COURSE, not the role: a
    // conversation must name a course, and every participant must belong to it.
    // Enforced by triggers rather than only by RLS, because messages-helper writes as
    // the service role and RLS does not apply to it.
    const unscoped = await rest(studentToken, 'conversations', {
      method: 'POST',
      body: JSON.stringify({ subject: 'E2E directory DM probe', is_group: false, created_by: MEMBER_ID }),
    });
    expect(unscoped.status, `expected rejection, got ${unscoped.status}: ${unscoped.body}`)
      .toBeGreaterThanOrEqual(400);

    // messages-helper's createConversation derives the course from
    // courses_shared_by_users, so it succeeds for people who share one and the row it
    // writes is course-scoped like any other. Assert the scoping, not a rejection —
    // this spec exists to prove threads cannot escape a course, and a 200 that produced
    // an unscoped row would be the actual regression.
    const viaFunction = await fetch(`${SUPABASE_URL}/functions/v1/messages-helper`, {
      method: 'POST',
      headers: authHeaders(studentToken),
      body: JSON.stringify({
        action: 'createConversation',
        subject: PROBE_SUBJECT,
        recipientIds: [OTHER_STUDENT_ID],
      }),
    });
    const viaFunctionBody = await viaFunction.text();
    expect(viaFunction.status, `createConversation failed: ${viaFunctionBody}`).toBe(200);
    const { conversationId } = JSON.parse(viaFunctionBody) as { conversationId: string };

    const scoped = await rest(studentToken, `conversations?id=eq.${conversationId}&select=id,course_id`);
    const [row] = JSON.parse(scoped.body) as Array<{ id: string; course_id: string | null }>;
    expect(row, 'the created conversation should be readable by its creator').toBeTruthy();
    expect(row.course_id, 'a conversation must belong to a course').not.toBeNull();

    // Clean up: this one really was created, unlike the rejected probe above.
    await rest(studentToken, `conversation_participants?conversation_id=eq.${conversationId}`, {
      method: 'DELETE',
    });
    await rest(studentToken, `conversations?id=eq.${conversationId}`, { method: 'DELETE' });
  });

  test('a user with no shared course still cannot be messaged', async () => {
    // The rule loosened from "students may only address instructors" to "anyone in the
    // course", and this is the line that did not move.
    const { status, body } = await rpc(studentToken, 'open_course_thread', {
      p_course_id: COURSE_ID,
      p_other_user_id: NO_SHARED_COURSE_ID,
    });
    expect(status, `expected rejection, got ${status}: ${body}`).toBeGreaterThanOrEqual(400);
    expect(body).toMatch(/not part of this course/i);
  });

  /**
   * The picker's rule, tested where it can actually be checked.
   *
   * CourseThreadComposer used to build its contact list client-side from `courses` +
   * `enrollments` + `course_assignments`, and could never show a student their
   * classmates: `enrollments` is RLS-restricted to `user_id = auth.uid()` OR staff, so a
   * student reads back one row — their own. The unit tests passed throughout, because
   * stubbing those tables stubbed away the restriction that made it impossible. Only a
   * run against the real database caught it.
   *
   * `course_contacts` (20260802160000) moved the rule into SQL, so these assertions live
   * at the layer that can execute it. They are the counterpart to the ones deleted from
   * CourseThreadComposer.test.tsx.
   */
  test('course_contacts offers a student their classmates as well as the teaching staff', async () => {
    const { status, body } = await rpc(studentToken, 'course_contacts', {
      p_course_id: COURSE_ID,
    });
    expect(status, `course_contacts failed: ${body}`).toBe(200);
    const contacts = JSON.parse(body) as Array<{ id: string; role: string }>;

    const ids = contacts.map((c) => c.id);
    expect(
      ids,
      'a classmate is missing — this is the exact failure course_contacts exists to fix, ' +
        'so check that the migration is applied before touching the assertion',
    ).toContain(OTHER_STUDENT_ID);
    expect(ids).toContain(INSTRUCTOR_ID);

    // Never yourself: the composer would offer a dead end, since open_course_thread
    // refuses a self-message with "Invalid recipient".
    expect(ids).not.toContain(MEMBER_ID);
    // Never someone outside the course, however loose the rule became.
    expect(ids).not.toContain(NO_SHARED_COURSE_ID);

    expect(contacts.find((c) => c.id === INSTRUCTOR_ID)?.role).toBe('instructor');
    expect(contacts.find((c) => c.id === OTHER_STUDENT_ID)?.role).toBe('student');
  });

  test('course_contacts offers an instructor their students, and offers an outsider nobody', async () => {
    const asInstructor = await rpc(instructorToken, 'course_contacts', {
      p_course_id: COURSE_ID,
    });
    expect(asInstructor.status, `course_contacts failed: ${asInstructor.body}`).toBe(200);
    const taught = (JSON.parse(asInstructor.body) as Array<{ id: string }>).map((c) => c.id);
    expect(taught).toContain(MEMBER_ID);
    expect(taught).not.toContain(INSTRUCTOR_ID);

    // Zero rows rather than an error, which is what lets the composer say "there is
    // nobody in this course you can message yet" instead of showing a failure.
    const outsider = await rpc(studentToken, 'course_contacts', {
      p_course_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(outsider.status).toBe(200);
    expect(JSON.parse(outsider.body)).toEqual([]);
  });
});
