// ABOUTME: Full instructor course-creation workflow, exercising every content_item_type.
// ABOUTME: Uses a live signed-in instructor JWT to POST via PostgREST end-to-end, then
// ABOUTME: verifies persisted rows for course, module, and each content type (page,
// ABOUTME: assignment + assignments row, quiz + quiz_questions row, discussion,
// ABOUTME: external_url, external_tool) and cleans up on completion.
import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

// Enum values from content_item_type. Every one MUST be covered.
const CONTENT_TYPES = [
  'page',
  'assignment',
  'quiz',
  'discussion',
  'external_url',
  'external_tool',
] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

function headers(token: string, prefer?: string) {
  const h: Record<string, string> = {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (prefer) h.Prefer = prefer;
  return h;
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

async function insert<T = any>(
  token: string,
  table: string,
  row: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(token, 'return=representation'),
    body: JSON.stringify(row),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`insert into ${table} failed (${res.status}): ${text}`);
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

async function del(token: string, path: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: headers(token),
  });
}

async function decodeUserId(token: string): Promise<string> {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
  );
  return payload.sub as string;
}

test.describe('Course creation — full workflow with coverage for every content type', () => {
  let token: string;
  let instructorId: string;
  const created = {
    courseId: '' as string,
    moduleId: '' as string,
    contentItemIds: [] as string[],
    assignmentId: '' as string,
    quizId: '' as string,
    quizQuestionId: '' as string,
  };

  test.beforeAll(async () => {
    const email = process.env.E2E_INSTRUCTOR_EMAIL ?? 'e2e-instructor@insightscollective.org';
    const password = process.env.E2E_INSTRUCTOR_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
    if (!password) {
      throw new Error(
        'Seed gap: E2E_INSTRUCTOR_PASSWORD (or E2E_TEST_PASSWORD) must be set to run course creation coverage.',
      );
    }
    token = await signIn(email, password);
    instructorId = await decodeUserId(token);
  });

  test.afterAll(async () => {
    // Best-effort cleanup — child rows cascade via schema FKs where configured;
    // explicit deletes keep tests idempotent across runs.
    if (created.quizQuestionId) {
      await del(token, `quiz_questions?id=eq.${created.quizQuestionId}`);
    }
    if (created.quizId) await del(token, `quizzes?id=eq.${created.quizId}`);
    if (created.assignmentId) await del(token, `assignments?id=eq.${created.assignmentId}`);
    for (const id of created.contentItemIds) {
      await del(token, `content_items?id=eq.${id}`);
    }
    if (created.moduleId) await del(token, `modules?id=eq.${created.moduleId}`);
    if (created.courseId) await del(token, `courses?id=eq.${created.courseId}`);
  });

  test('creates a course with title, description, image, category, level, instructor', async () => {
    const suffix = Date.now().toString(36);
    const course = await insert<{ id: string }>(token, 'courses', {
      title: `E2E Coverage Course ${suffix}`,
      description: 'End-to-end coverage of every lesson content type.',
      category: 'Data Science',
      level: 'Beginner',
      image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800',
      thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400',
      instructor_id: instructorId,
      status: 'draft',
      published: false,
    });
    expect(course.id).toMatch(/^[0-9a-f-]{36}$/i);
    created.courseId = course.id;
  });

  test('creates a weekly module under the course', async () => {
    expect(created.courseId, 'course must exist').toBeTruthy();
    const mod = await insert<{ id: string }>(token, 'modules', {
      course_id: created.courseId,
      title: 'Week 1 — Foundations',
      description: 'Kickoff week covering every content type in the platform.',
      week: 1,
      position: 0,
      published: true,
    });
    expect(mod.id).toMatch(/^[0-9a-f-]{36}$/i);
    created.moduleId = mod.id;
  });

  for (let i = 0; i < CONTENT_TYPES.length; i++) {
    const type = CONTENT_TYPES[i];
    test(`creates a "${type}" content item and its type-specific rows`, async () => {
      expect(created.moduleId, 'module must exist').toBeTruthy();

      const titleByType: Record<ContentType, string> = {
        page: 'Reading: Course overview',
        assignment: 'Assignment: Reflection essay',
        quiz: 'Quiz: Knowledge check',
        discussion: 'Discussion: Introduce yourself',
        external_url: 'External link: Reference article',
        external_tool: 'External tool: Interactive notebook',
      };

      const settingsByType: Record<ContentType, Record<string, unknown>> = {
        page: {
          body: '<h2>Welcome</h2><p>Read this before moving on.</p>',
          contentSubtype: 'page',
        },
        assignment: { points: 100, dueInDays: 7 },
        quiz: { timeLimitMinutes: 15, allowedAttempts: 2 },
        discussion: { requireReplyBeforeSeeingOthers: true },
        external_url: { url: 'https://example.com/reference-article', openInNewTab: true },
        external_tool: { url: 'https://colab.research.google.com/', toolName: 'Colab' },
      };

      const item = await insert<{ id: string; type: string }>(token, 'content_items', {
        course_id: created.courseId,
        module_id: created.moduleId,
        type,
        title: titleByType[type],
        content: type === 'page' ? (settingsByType.page.body as string) : null,
        position: i,
        published: true,
        settings: settingsByType[type],
        created_by: instructorId,
      });
      expect(item.type).toBe(type);
      created.contentItemIds.push(item.id);

      if (type === 'assignment') {
        const a = await insert<{ id: string }>(token, 'assignments', {
          course_id: created.courseId,
          module_id: created.moduleId,
          content_item_id: item.id,
          title: titleByType.assignment,
          description: 'Write a 300-word reflection on Week 1.',
          instructions: 'Submit a text response. Rubric-graded.',
          points: 100,
          grading_type: 'points',
          submission_types: ['online_text_entry'],
          max_attempts: 1,
          is_published: true,
        });
        expect(a.id).toBeTruthy();
        created.assignmentId = a.id;
      }

      if (type === 'quiz') {
        const q = await insert<{ id: string }>(token, 'quizzes', {
          content_item_id: item.id,
          module_id: created.moduleId,
          title: titleByType.quiz,
          description: 'Quick check of Week 1 concepts.',
          quiz_type: 'assignment',
          points_possible: 10,
          allowed_attempts: 2,
          time_limit: 15,
          shuffle_answers: false,
          shuffle_questions: false,
          show_correct_answers: true,
        });
        expect(q.id).toBeTruthy();
        created.quizId = q.id;

        const qq = await insert<{ id: string }>(token, 'quiz_questions', {
          quiz_id: q.id,
          question_text: 'What is 2 + 2?',
          question_type: 'multiple_choice',
          options: [
            { id: 'a', text: '3' },
            { id: 'b', text: '4' },
            { id: 'c', text: '5' },
          ],
          correct_answer: 'b',
          explanation: 'Basic arithmetic.',
          points: 10,
          position: 0,
        });
        expect(qq.id).toBeTruthy();
        created.quizQuestionId = qq.id;
      }
    });
  }

  test('reads back the course tree and confirms every content type is present', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/content_items?course_id=eq.${created.courseId}&select=id,type,title,module_id,published`,
      { headers: headers(token) },
    );
    expect(res.ok, `read failed: ${await res.text()}`).toBe(true);
    const items = (await res.json()) as Array<{ type: ContentType; module_id: string; published: boolean }>;

    // All 6 types must be covered.
    const foundTypes = new Set(items.map((i) => i.type));
    for (const t of CONTENT_TYPES) {
      expect(foundTypes.has(t), `missing content type in created course: ${t}`).toBe(true);
    }

    // Every item is attached to our module and published.
    for (const it of items) {
      expect(it.module_id).toBe(created.moduleId);
      expect(it.published).toBe(true);
    }

    // Assignment row linked and quiz row + at least one question exist.
    const asgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/assignments?course_id=eq.${created.courseId}&select=id,title,points`,
      { headers: headers(token) },
    );
    const asgs = (await asgRes.json()) as any[];
    expect(asgs.length).toBeGreaterThanOrEqual(1);

    const qzRes = await fetch(
      `${SUPABASE_URL}/rest/v1/quizzes?id=eq.${created.quizId}&select=id,title,points_possible`,
      { headers: headers(token) },
    );
    const qzs = (await qzRes.json()) as any[];
    expect(qzs.length).toBe(1);

    const qqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/quiz_questions?quiz_id=eq.${created.quizId}&select=id,question_type`,
      { headers: headers(token) },
    );
    const qqs = (await qqRes.json()) as any[];
    expect(qqs.length).toBeGreaterThanOrEqual(1);
  });

  test('publishes the course and confirms it becomes visible in the catalog view', async () => {
    const patch = await fetch(
      `${SUPABASE_URL}/rest/v1/courses?id=eq.${created.courseId}`,
      {
        method: 'PATCH',
        headers: headers(token, 'return=representation'),
        body: JSON.stringify({ status: 'published', published: true }),
      },
    );
    expect(patch.ok, `publish failed: ${await patch.text()}`).toBe(true);

    const cat = await fetch(
      `${SUPABASE_URL}/rest/v1/courses?id=eq.${created.courseId}&status=eq.published&select=id,title,status`,
      { headers: headers(token) },
    );
    const rows = (await cat.json()) as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('published');
  });
});
