// ABOUTME: E2E — full course completion sequence in a single flow:
// ABOUTME: student submits an assignment, instructor leaves rubric feedback, then every content item
// ABOUTME: is completed and the certificate trigger auto-issues a verifiable certificate.
import { test, expect } from '../fixtures/page-helpers';
import { signInMember, getSupabaseAccessToken } from './_helpers/signIn';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
const ASSIGNMENT_ID = '24de9d6a-5110-4bb5-968c-5f8f6b143461';
const ASSIGNMENT_CONTENT_ITEM_ID = 'dc50f7dc-47be-4541-aae5-98375b128a08';

test.describe('Full course completion sequence', () => {
  test.beforeEach(async ({ page }) => { await signInMember(page); });

  test('assignment submission → instructor feedback → auto-issued certificate', async ({ page }) => {
    await page.goto('/dashboard');
    const token = await getSupabaseAccessToken(page);
    expect(token, 'session access token').toBeTruthy();
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    // Resolve user id
    const meRes = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers });
    // Body included deliberately: the status alone says the token was rejected
    // but not why, which is the only useful thing when this fails in CI.
    expect(
      meRes.ok(),
      `auth/v1/user ${meRes.status()} — ${(await meRes.text()).slice(0, 300)}`,
    ).toBeTruthy();
    const userId = (await meRes.json()).id as string;
    expect(userId).toBeTruthy();

    // Ensure enrollment exists — create only if missing (RLS forbids updates)
    const existingEnroll = await page.request.get(
      `${SUPABASE_URL}/rest/v1/enrollments?user_id=eq.${userId}&course_id=eq.${COURSE_ID}&select=id`,
      { headers },
    );
    const enrollRows = existingEnroll.ok() ? await existingEnroll.json() : [];
    if (!enrollRows.length) {
      const enrollRes = await page.request.post(
        `${SUPABASE_URL}/rest/v1/enrollments`,
        { headers: { ...headers, Prefer: 'return=minimal' },
          data: JSON.stringify({ user_id: userId, course_id: COURSE_ID }) },
      );
      expect(enrollRes.ok(), `enrollment insert (${enrollRes.status()}: ${await enrollRes.text()})`).toBeTruthy();
    }

    // Fetch every published content item for the course
    const itemsRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/content_items?select=id,module_id,published,modules!inner(course_id,published)&modules.course_id=eq.${COURSE_ID}&modules.published=eq.true&published=eq.true`,
      { headers },
    );
    expect(itemsRes.ok(), `content_items (${itemsRes.status()})`).toBeTruthy();
    const items = (await itemsRes.json()) as Array<{ id: string }>;
    expect(items.length, 'seeded course must publish content items').toBeGreaterThan(0);
    const itemIds = items.map((i) => i.id);

    // Reset prior submission, progressions, and certificate so this run truly exercises the flow
    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/certificates?user_id=eq.${userId}&course_id=eq.${COURSE_ID}`,
      { headers },
    );
    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?user_id=eq.${userId}&content_item_id=in.(${itemIds.join(',')})`,
      { headers },
    );
    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?assignment_id=eq.${ASSIGNMENT_ID}&user_id=eq.${userId}`,
      { headers },
    );

    // ---- Phase 1: student submits the assignment via REST (mirrors the UI submit) ----
    const submitRes = await page.request.post(
      `${SUPABASE_URL}/rest/v1/assignment_submissions`,
      {
        headers,
        data: JSON.stringify({
          assignment_id: ASSIGNMENT_ID,
          user_id: userId,
          workflow_state: 'submitted',
          body: 'E2E full-completion run',
          submitted_at: new Date().toISOString(),
          attempt: 1,
        }),
      },
    );
    expect(submitRes.ok(), `submission insert (${submitRes.status()}: ${await submitRes.text()})`).toBeTruthy();
    const submissionId = (await submitRes.json())[0]?.id as string;
    expect(submissionId).toBeTruthy();

    // ---- Phase 2: instructor grades the submission with rubric feedback ----
    const gradeRes = await page.request.patch(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?id=eq.${submissionId}`,
      {
        headers,
        data: JSON.stringify({
          workflow_state: 'graded',
          score: 92,
          grader_comments: 'Full-flow E2E feedback: strong analysis, clear conclusion.',
          graded_at: new Date().toISOString(),
        }),
      },
    );
    expect(gradeRes.ok(), `grade update (${gradeRes.status()})`).toBeTruthy();

    // Verify the student sees the graded feedback in the lesson viewer
    await page.goto(`/courses/${COURSE_ID}/learn`);
    await page.waitForLoadState('networkidle').catch(() => {});
    const [firstModule] = (
      await (await page.request.get(
        `${SUPABASE_URL}/rest/v1/modules?course_id=eq.${COURSE_ID}&published=eq.true&select=id&order=week.asc&limit=1`,
        { headers },
      )).json()
    ) as Array<{ id: string }>;
    if (firstModule) {
      await page.goto(`/courses/${COURSE_ID}/learn/${firstModule.id}/${ASSIGNMENT_CONTENT_ITEM_ID}`);
      await expect(page.getByText(/Graded · Attempt/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Score 92/i)).toBeVisible();
      await expect(page.getByText(/Full-flow E2E feedback/i)).toBeVisible();
    }

    // ---- Phase 3: complete every content item → certificate auto-issues ----
    const rows = itemIds.map((id) => ({
      user_id: userId,
      content_item_id: id,
      workflow_state: 'completed',
    }));
    const progRes = await page.request.post(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?on_conflict=user_id,content_item_id`,
      {
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        data: JSON.stringify(rows),
      },
    );
    expect(progRes.ok(), `progressions upsert (${progRes.status()}: ${await progRes.text()})`).toBeTruthy();

    // Poll for the trigger-issued certificate
    let cert: any = null;
    for (let i = 0; i < 12 && !cert; i++) {
      const res = await page.request.get(
        `${SUPABASE_URL}/rest/v1/certificates?user_id=eq.${userId}&course_id=eq.${COURSE_ID}&select=verification_code,certificate_type,certificate_data,issued_at`,
        { headers },
      );
      if (res.ok()) {
        const arr = await res.json();
        if (arr.length) { cert = arr[0]; break; }
      }
      await page.waitForTimeout(500);
    }
    expect(cert, 'certificate auto-issued by trigger').toBeTruthy();
    expect(cert.certificate_type).toBe('completion');
    expect(String(cert.verification_code)).toMatch(/^[A-Z0-9]{12}$/);
    expect(cert.certificate_data?.auto_issued).toBe(true);

    // Certificate page reflects the issued certificate
    await page.goto(`/courses/${COURSE_ID}/certificate`);
    await expect(
      page.getByRole('heading', {
        name: /(course certificate|your certificate is ready)/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/must complete all course requirements/i)).toHaveCount(0);
  });
});
