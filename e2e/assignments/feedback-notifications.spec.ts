// ABOUTME: Real-session coverage for the student feedback notifications: instructor
// ABOUTME: comments and rubric-only feedback must notify the student and deep-link back.
//
// Every write here goes through PostgREST with a live signed-in JWT, so the
// notify_student_on_submission_comment / notify_student_on_grade triggers run
// exactly as they do in production. The negative cases (private note, draft,
// student's own comment) are the reason the triggers cannot simply fire on every
// insert, so they are asserted, not assumed. Rows created by the spec are
// removed in afterAll — comments by the instructor, notifications by the student
// (RLS scopes notification DELETE to auth.uid()).
import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

const SUPABASE_URL = 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

// Seeded in e2e/fixtures/seed.sql: the member's submission for an assignment that
// carries a module_id, which is what the notification link is built from.
const SUBMISSION_ID = 'cccc5555-5555-5555-5555-555555555555';
const ASSIGNMENT_ID = 'cccc4444-4444-4444-4444-444444444444';
const MODULE_ID = '770e8400-e29b-41d4-a716-446655440001';
const COURSE_ID = '660e8400-e29b-41d4-a716-446655440001';
const INSTRUCTOR_ID = '30609adf-dc50-4b57-a456-1f38201e40de'; // e2e-instructor@insightscollective.org
const STUDENT_ID = '575f018c-fa13-4e36-959f-7aba223b1e53'; // e2e-member@insightscollective.org

const DEEP_LINK = `/courses/${COURSE_ID}/modules/${MODULE_ID}/assignments/${ASSIGNMENT_ID}`;

function headers(token: string) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function signIn(email: string, password: string): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`sign-in failed for ${email}: ${await r.text()}`);
  return (await r.json()).access_token as string;
}

async function insertComment(token: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/submission_comments`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      submission_id: SUBMISSION_ID,
      submission_type: 'assignment',
      comment_type: 'feedback',
      ...body,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`comment insert failed: ${res.status} ${text}`);
  const row = JSON.parse(text)[0];
  createdComments.push({ id: row.id, author: row.author_type });
  return row;
}

async function patchComment(token: string, id: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/submission_comments?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`comment patch failed: ${res.status} ${await res.text()}`);
}

// The student reads their own inbox with their own JWT, so a policy regression
// that hid the notification would fail here rather than silently pass.
async function studentNotifications(token: string, since: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${STUDENT_ID}&created_at=gte.${since}` +
      `&select=id,type,title,message,link,created_at&order=created_at.desc`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(`notifications read failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
  }>;
}

const createdComments: Array<{ id: string; author: string }> = [];
let instructorToken = '';
let studentToken = '';
let startedAt = '';

test.describe.configure({ mode: 'serial' });

test.describe('Assignment feedback notifications (student inbox)', () => {
  test.beforeAll(async () => {
    const shared = process.env.E2E_TEST_PASSWORD;
    instructorToken = await signIn(
      process.env.E2E_INSTRUCTOR_EMAIL || 'e2e-instructor@insightscollective.org',
      process.env.E2E_INSTRUCTOR_PASSWORD || shared || '',
    );
    studentToken = await signIn(
      process.env.E2E_MEMBER_EMAIL || 'e2e-member@insightscollective.org',
      process.env.E2E_MEMBER_PASSWORD || shared || '',
    );
    // One second back, so the window cannot exclude a row written in the same tick.
    startedAt = new Date(Date.now() - 1000).toISOString();
  });

  test.afterAll(async () => {
    // submission_comments carries no DELETE policy on purpose — feedback is
    // soft-deleted (deleted_at), the same way gradeHistoryService removes a
    // comment. A hard DELETE here returned 0 rows and left every spec comment
    // behind, so clean up the way the app does, as each row's own author.
    for (const { id, author } of createdComments) {
      await fetch(`${SUPABASE_URL}/rest/v1/submission_comments?id=eq.${id}`, {
        method: 'PATCH',
        headers: headers(author === 'student' ? studentToken : instructorToken),
        body: JSON.stringify({ deleted_at: new Date().toISOString() }),
      }).catch(() => {});
    }
    // Audit rows are intentionally immutable; only the inbox is cleaned.
    await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${STUDENT_ID}&created_at=gte.${startedAt}` +
        `&type=in.(submission_feedback,assignment_graded)`,
      { method: 'DELETE', headers: headers(studentToken) },
    ).catch(() => {});
  });

  test('an instructor comment notifies the student and deep-links to the module assignment', async () => {
    await insertComment(instructorToken, {
      comment_text: 'E2E: your cleaning steps are clear — tighten the summary.',
      author_id: INSTRUCTOR_ID,
      author_type: 'instructor',
      is_private: false,
      is_draft: false,
    });

    const rows = await studentNotifications(studentToken, startedAt);
    const created = rows.find((r) => /^New feedback:/.test(r.title));
    expect(created, `no "New feedback" notification in ${JSON.stringify(rows)}`).toBeTruthy();
    expect(created!.type).toBe('submission_feedback');
    expect(created!.link).toBe(DEEP_LINK);
  });

  test('editing the comment notifies the student that feedback was updated', async () => {
    const comment = await insertComment(instructorToken, {
      comment_text: 'E2E: first pass.',
      author_id: INSTRUCTOR_ID,
      author_type: 'instructor',
      is_private: false,
      is_draft: false,
    });
    const before = new Date().toISOString();
    await patchComment(instructorToken, comment.id, { comment_text: 'E2E: revised guidance.', is_edited: true });

    const rows = await studentNotifications(studentToken, before);
    expect(
      rows.some((r) => /^Feedback updated:/.test(r.title)),
      `no "Feedback updated" notification in ${JSON.stringify(rows)}`,
    ).toBe(true);
  });

  test('private notes and drafts never reach the student', async () => {
    const before = new Date().toISOString();
    await insertComment(instructorToken, {
      comment_text: 'E2E: internal note, do not surface.',
      author_id: INSTRUCTOR_ID,
      author_type: 'instructor',
      is_private: true,
      is_draft: false,
    });
    await insertComment(instructorToken, {
      comment_text: 'E2E: unsent draft.',
      author_id: INSTRUCTOR_ID,
      author_type: 'instructor',
      is_private: false,
      is_draft: true,
    });

    const rows = await studentNotifications(studentToken, before);
    expect(rows.filter((r) => r.type === 'submission_feedback')).toHaveLength(0);
  });

  test("a student's own comment does not notify the student", async () => {
    const before = new Date().toISOString();
    await insertComment(studentToken, {
      comment_text: 'E2E: question from the student.',
      author_id: STUDENT_ID,
      author_type: 'student',
      is_private: false,
      is_draft: false,
    });

    const rows = await studentNotifications(studentToken, before);
    expect(rows.filter((r) => r.type === 'submission_feedback')).toHaveLength(0);
  });

  // Regression: clearing a rubric used to send "Your instructor added rubric
  // feedback on your submission." with no rubric behind the link.
  test('removing rubric feedback does not notify the student', async () => {
    const submission = 'c4f2a012-07aa-4cf9-837b-0d16abd7c0c4'; // member, Data Cleaning Exercise
    const patch = (rubric: unknown) =>
      fetch(`${SUPABASE_URL}/rest/v1/assignment_submissions?id=eq.${submission}`, {
        method: 'PATCH',
        headers: headers(instructorToken),
        body: JSON.stringify({ rubric_scores: rubric }),
      });

    // IDENTIFIED BY ID, NOT BY TIMESTAMP, AND THAT IS THE WHOLE FIX.
    //
    // This used to capture `before = new Date().toISOString()` between the two
    // patches and then ask for notifications with `created_at >= before`. But
    // `created_at` is written by the DATABASE clock while `new Date()` reads
    // THIS machine's, and the two disagree — measured 1.5s apart here, with the
    // database ahead. So the notification the ADD step legitimately produced
    // carried a `created_at` later than `before`, landed inside the "after
    // clear" window, and was reported as the clear having notified the student.
    // The trigger was innocent: notify_student_on_grade only sets
    // v_rubric_changed when NEW.rubric_scores IS NOT NULL, so a clear cannot
    // notify.
    //
    // It fails 3/3 alone here and passed in a slower sandbox, which looks
    // backwards until you see why: the gap between the add and `before` is one
    // HTTP round trip, so a slow relay lets wall-clock overtake the skew and a
    // fast one does not. A timing assumption that inverts with latency is not
    // one to re-tune — comparing ids removes the clock from the question
    // entirely.
    //
    // The window start stays deliberately generous for the same reason: both
    // reads use it, so only the id difference between them matters.
    const RUBRIC_NOTIFICATION = /^Rubric feedback:/;
    const windowStart = new Date(Date.now() - 60_000).toISOString();

    const added = await patch({ clarity: { points: 4, comment: 'E2E rubric' } });
    expect(added.status, await added.text()).toBe(200);
    const afterAdd = (await studentNotifications(studentToken, windowStart)).filter((r) =>
      RUBRIC_NOTIFICATION.test(r.title),
    );
    expect(afterAdd.length, 'adding a rubric notifies the student').toBeGreaterThan(0);
    const knownIds = new Set(afterAdd.map((r) => r.id));

    const cleared = await patch(null);
    expect(cleared.status, await cleared.text()).toBe(200);
    // Only rubric notifications that did not already exist. Scoping to the
    // title also keeps a concurrent spec's traffic out of this assertion: the
    // shared member is graded by journeys/assignment-submission-feedback.spec.ts
    // too, and an unrelated `assignment_graded` for a different assignment used
    // to fail this test as well.
    const afterClear = (await studentNotifications(studentToken, windowStart)).filter(
      (r) => RUBRIC_NOTIFICATION.test(r.title) && !knownIds.has(r.id),
    );
    expect(
      afterClear,
      `clearing the rubric notified the student: ${JSON.stringify(afterClear)}`,
    ).toHaveLength(0);
  });

  test('the notification renders in the student inbox and opens the assignment', async ({ page }) => {
    const before = new Date().toISOString();
    await insertComment(instructorToken, {
      comment_text: 'E2E: rendered-in-the-inbox check.',
      author_id: INSTRUCTOR_ID,
      author_type: 'instructor',
      is_private: false,
      is_draft: false,
    });
    const rows = await studentNotifications(studentToken, before);
    expect(rows.some((r) => /^New feedback:/.test(r.title))).toBe(true);

    await goto(page, Routes.notifications);
    const card = page
      .locator('[data-testid="notification-card"]')
      .filter({ hasText: 'New feedback:' })
      .first();
    await expect(card).toBeVisible();
    await expect(card.getByText(/left feedback on your submission/i)).toBeVisible();

    await card.click();
    // Landing on the module assignment is the whole point of the link column;
    // a null link would leave the user on /notifications.
    await expect(page).toHaveURL(new RegExp(`${MODULE_ID}|${COURSE_ID}/grades`));
  });
});
