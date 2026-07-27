// ABOUTME: End-to-end smoke test — instructor creates a fresh course with a weekly module,
// ABOUTME: page + assignment content, then a student enrolls, advances through the module,
// ABOUTME: submits the assignment, and progress updates are verified in the database.
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

function h(token: string, prefer?: string) {
  const out: Record<string, string> = {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (prefer) out.Prefer = prefer;
  return out;
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

function sub(token: string): string {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8')).sub as string;
}

// Insert with client-generated id + return=minimal to avoid PostgREST re-SELECTing
// through RLS SELECT policies that call STABLE security-definer functions.
async function insertMinimal(
  token: string,
  table: string,
  row: Record<string, unknown>,
): Promise<{ id: string }> {
  const id = (row.id as string | undefined) ?? randomUUID();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: h(token, 'return=minimal'),
    body: JSON.stringify({ id, ...row }),
  });
  if (!res.ok) throw new Error(`insert ${table} failed (${res.status}): ${await res.text()}`);
  return { id };
}

test.describe.configure({ mode: 'serial' });
test.describe('Smoke — instructor course creation through student progress', () => {
  const password =
    process.env.E2E_TEST_PASSWORD ||
    process.env.E2E_INSTRUCTOR_PASSWORD ||
    process.env.E2E_MEMBER_PASSWORD;
  const instructorEmail =
    process.env.E2E_INSTRUCTOR_EMAIL || 'e2e-instructor@insightscollective.org';
  const studentEmail =
    process.env.E2E_MEMBER_EMAIL || 'e2e-member@insightscollective.org';

  const suffix = Date.now().toString(36);
  const state = {
    instructorToken: '',
    studentToken: '',
    instructorId: '',
    studentId: '',
    courseId: '',
    moduleId: '',
    lessonItemId: '',
    assignmentItemId: '',
    assignmentId: '',
    submissionId: '',
  };

  test.beforeAll(async () => {
    if (!password) {
      throw new Error(
        'Seed gap: E2E_TEST_PASSWORD (or role-specific password) must be set for the smoke test.',
      );
    }
    state.instructorToken = await signIn(instructorEmail, password);
    state.studentToken = await signIn(studentEmail, password);
    state.instructorId = sub(state.instructorToken);
    state.studentId = sub(state.studentToken);
  });

  test.afterAll(async () => {
    const it = state.instructorToken;
    if (!it) return;
    // Cascade-friendly cleanup order — best-effort per resource so a failure
    // partway through the spec still tears the rest down.
    const tryDelete = async (path: string) => {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers: h(it) });
      } catch {
        /* best-effort */
      }
    };

    if (state.submissionId) await tryDelete(`assignment_submissions?id=eq.${state.submissionId}`);
    if (state.assignmentId) await tryDelete(`assignments?id=eq.${state.assignmentId}`);
    for (const id of [state.assignmentItemId, state.lessonItemId].filter(Boolean)) {
      await tryDelete(`content_item_progressions?content_item_id=eq.${id}`);
      await tryDelete(`content_items?id=eq.${id}`);
    }
    if (state.moduleId) await tryDelete(`modules?id=eq.${state.moduleId}`);
    if (state.courseId) {
      await tryDelete(`enrollments?course_id=eq.${state.courseId}`);
      await tryDelete(`certificates?course_id=eq.${state.courseId}`);
      await tryDelete(`courses?id=eq.${state.courseId}`);
    }

    // Belt-and-suspenders sweep: catch any prior-run "Smoke Course …" rows
    // owned by this instructor that leaked because the process was killed
    // before afterAll ran. Scoped strictly by title prefix + instructor_id,
    // so it can never delete real catalog courses.
    try {
      const leaked = await fetch(
        `${SUPABASE_URL}/rest/v1/courses?instructor_id=eq.${state.instructorId}&title=like.Smoke%20Course%20*&select=id`,
        { headers: h(it) },
      );
      const rows = (await leaked.json()) as Array<{ id: string }>;
      for (const row of rows) {
        await tryDelete(`certificates?course_id=eq.${row.id}`);
        await tryDelete(`enrollments?course_id=eq.${row.id}`);
        await tryDelete(`assignment_submissions?assignment_id=in.(select id from assignments where course_id=eq.${row.id})`);
        await tryDelete(`assignments?course_id=eq.${row.id}`);
        await tryDelete(`content_items?course_id=eq.${row.id}`);
        await tryDelete(`modules?course_id=eq.${row.id}`);
        await tryDelete(`courses?id=eq.${row.id}`);
      }
    } catch {
      /* best-effort sweep */
    }
  });

  test('instructor creates a course with a weekly module and two content items', async () => {
    const course = await insertMinimal(state.instructorToken, 'courses', {
      title: `Smoke Course ${suffix}`,
      description: 'Smoke: instructor → student progress.',
      category: 'Data Science',
      level: 'Beginner',
      instructor_id: state.instructorId,
      status: 'published',
      published: true,
    });
    state.courseId = course.id;

    const mod = await insertMinimal(state.instructorToken, 'modules', {
      course_id: state.courseId,
      title: 'Week 1 — Kickoff',
      description: 'First weekly module.',
      week: 1,
      position: 0,
      published: true,
    });
    state.moduleId = mod.id;

    const lesson = await insertMinimal(state.instructorToken, 'content_items', {
      course_id: state.courseId,
      module_id: state.moduleId,
      type: 'page',
      title: 'Welcome reading',
      content: '<p>Read this to begin the course.</p>',
      position: 0,
      published: true,
      settings: { body: '<p>Read this to begin the course.</p>' },
      created_by: state.instructorId,
    });
    state.lessonItemId = lesson.id;

    const asgItem = await insertMinimal(state.instructorToken, 'content_items', {
      course_id: state.courseId,
      module_id: state.moduleId,
      type: 'assignment',
      title: 'Week 1 reflection',
      position: 1,
      published: true,
      settings: { points: 100 },
      created_by: state.instructorId,
    });
    state.assignmentItemId = asgItem.id;

    const asg = await insertMinimal(state.instructorToken, 'assignments', {
      course_id: state.courseId,
      module_id: state.moduleId,
      content_item_id: state.assignmentItemId,
      title: 'Week 1 reflection',
      description: '150-word reflection on the kickoff reading.',
      instructions: 'Submit as online text.',
      points: 100,
      grading_type: 'points',
      submission_types: ['online_text_entry'],
      max_attempts: 1,
      is_published: true,
    });
    state.assignmentId = asg.id;
  });

  test('student enrolls in the course', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enrollments`, {
      method: 'POST',
      headers: h(state.studentToken, 'return=minimal'),
      body: JSON.stringify({ user_id: state.studentId, course_id: state.courseId }),
    });
    expect(res.ok, `enrollment failed (${res.status}): ${await res.text()}`).toBe(true);

    const read = await fetch(
      `${SUPABASE_URL}/rest/v1/enrollments?user_id=eq.${state.studentId}&course_id=eq.${state.courseId}&select=id`,
      { headers: h(state.studentToken) },
    );
    const rows = (await read.json()) as any[];
    expect(rows.length, 'enrollment must be readable back to the student').toBe(1);
  });

  test('student advances through the weekly module (page completed)', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?on_conflict=user_id,content_item_id`,
      {
        method: 'POST',
        headers: h(state.studentToken, 'resolution=merge-duplicates,return=minimal'),
        body: JSON.stringify([
          { user_id: state.studentId, content_item_id: state.lessonItemId, workflow_state: 'completed' },
        ]),
      },
    );
    expect(res.ok, `progression upsert (${res.status}): ${await res.text()}`).toBe(true);

    const read = await fetch(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?user_id=eq.${state.studentId}&content_item_id=eq.${state.lessonItemId}&select=workflow_state`,
      { headers: h(state.studentToken) },
    );
    const rows = (await read.json()) as Array<{ workflow_state: string }>;
    expect(rows.length).toBe(1);
    expect(['read', 'completed']).toContain(rows[0].workflow_state);
  });

  test('student submits the assignment', async () => {
    const id = randomUUID();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/assignment_submissions`, {
      method: 'POST',
      headers: h(state.studentToken, 'return=minimal'),
      body: JSON.stringify({
        id,
        assignment_id: state.assignmentId,
        user_id: state.studentId,
        workflow_state: 'submitted',
        body: 'Smoke test submission — kickoff reflection.',
        submitted_at: new Date().toISOString(),
        attempt: 1,
      }),
    });
    expect(res.ok, `submission insert (${res.status}): ${await res.text()}`).toBe(true);
    state.submissionId = id;

    const read = await fetch(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?id=eq.${id}&select=id,workflow_state,body`,
      { headers: h(state.studentToken) },
    );
    const rows = (await read.json()) as Array<{ workflow_state: string; body: string }>;
    expect(rows.length).toBe(1);
    expect(rows[0].workflow_state).toBe('submitted');
    expect(rows[0].body).toContain('kickoff reflection');
  });

  test('progress updates are visible: 1 of 2 items complete before the assignment is graded', async () => {
    const total = await fetch(
      `${SUPABASE_URL}/rest/v1/content_items?course_id=eq.${state.courseId}&published=eq.true&select=id`,
      { headers: h(state.studentToken) },
    );
    const totalRows = (await total.json()) as any[];
    expect(totalRows.length).toBe(2);

    const done = await fetch(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?user_id=eq.${state.studentId}&content_item_id=in.(${state.lessonItemId},${state.assignmentItemId})&workflow_state=in.(read,completed)&select=content_item_id`,
      { headers: h(state.studentToken) },
    );
    const doneRows = (await done.json()) as any[];
    expect(doneRows.length, 'exactly one item completed at this point').toBe(1);
  });

  test('instructor grades the submission and the student sees progress reach 100%', async () => {
    const grade = await fetch(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?id=eq.${state.submissionId}`,
      {
        method: 'PATCH',
        headers: h(state.instructorToken, 'return=minimal'),
        body: JSON.stringify({
          workflow_state: 'graded',
          score: 95,
          grader_comments: 'Nicely done — clear reflection.',
          graded_at: new Date().toISOString(),
        }),
      },
    );
    expect(grade.ok, `grade failed (${grade.status}): ${await grade.text()}`).toBe(true);

    // Mark the assignment content item complete for the student (mirrors "Continue" click after grading)
    const prog = await fetch(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?on_conflict=user_id,content_item_id`,
      {
        method: 'POST',
        headers: h(state.studentToken, 'resolution=merge-duplicates,return=minimal'),
        body: JSON.stringify([
          { user_id: state.studentId, content_item_id: state.assignmentItemId, workflow_state: 'completed' },
        ]),
      },
    );
    expect(prog.ok, `assignment progression (${prog.status}): ${await prog.text()}`).toBe(true);

    const done = await fetch(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?user_id=eq.${state.studentId}&content_item_id=in.(${state.lessonItemId},${state.assignmentItemId})&workflow_state=in.(read,completed)&select=content_item_id`,
      { headers: h(state.studentToken) },
    );
    const doneRows = (await done.json()) as any[];
    expect(doneRows.length, 'both content items complete after grading').toBe(2);
  });
});
