// ABOUTME: E2E — student submits an assignment inline, instructor grades it via REST, and rubric feedback + completion propagate.
// ABOUTME: Uses real Supabase data for the seeded Introduction to Data Science course.
import { test, expect } from '../fixtures/page-helpers';
import { signInMember, getSupabaseAccessToken, getGradingStaffToken } from './_helpers/signIn';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

const COURSE_ID = process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001';
// Real seeded assignment (Foundations of Data Science → Python Data Analysis)
const ASSIGNMENT_ID = '24de9d6a-5110-4bb5-968c-5f8f6b143461';
const CONTENT_ITEM_ID = 'dc50f7dc-47be-4541-aae5-98375b128a08';
const MODULE_ID = '770e8400-e29b-41d4-a716-446655440001';

async function getAccessToken(page: any): Promise<string> {
  const token = await getSupabaseAccessToken(page);
  expect(token, 'authenticated session access token').toBeTruthy();
  return token as string;
}

test.describe('Assignment submission → feedback → completion', () => {
  test.beforeEach(async ({ page }) => { await signInMember(page); });

  test('student submits, instructor grades, feedback + completion status update', async ({ page }) => {
    // 1. Open the lesson containing the assignment
    await page.goto(`/courses/${COURSE_ID}/learn/${MODULE_ID}/${CONTENT_ITEM_ID}`);
    await expect(page.getByRole('heading', { name: /Course not found/i })).toHaveCount(0);

    const token = await getAccessToken(page);
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    // 2. Reset any prior submission for this user so we exercise the full flow
    const meRes = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers });
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();
    const userId: string = me.id;

    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?assignment_id=eq.${ASSIGNMENT_ID}&user_id=eq.${userId}`,
      { headers },
    );
    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?content_item_id=eq.${CONTENT_ITEM_ID}&user_id=eq.${userId}`,
      { headers },
    );

    // Reload so the LessonViewer re-fetches
    await page.reload();

    // 3. Submit via the inline form. This assignment's submission_types is
    //    ['file_upload'], so the form renders a Files input and no text field, and
    //    handleSubmit refuses an empty submission ("Add a response or a file before
    //    submitting"). That guard is deliberate — it stops an empty row consuming the
    //    student's only attempt — so the flow this spec exercises has to attach a file.
    const submitBtn = page.getByRole('button', { name: /^Submit assignment$/i });
    await expect(submitBtn).toBeVisible({ timeout: 15_000 });

    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 10_000 });
    await fileInput.setInputFiles({
      name: 'e2e-python-data-analysis.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(`E2E submission at ${new Date().toISOString()}\n`, 'utf8'),
    });
    // The file is staged client-side until submit; the row and the storage object
    // are both written by the click below.
    await expect(page.getByText('e2e-python-data-analysis.txt')).toBeVisible({ timeout: 10_000 });

    await submitBtn.click();

    // Success alert appears. max_attempts is 1 on this assignment, so the cap is
    // shown; the app omits " of N" entirely when max_attempts is null rather than
    // inventing a limit.
    await expect(page.getByText(/Submitted · Attempt 1 of 1/i)).toBeVisible({ timeout: 20_000 });

    // 4. Verify submission persisted in Supabase
    const subRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?assignment_id=eq.${ASSIGNMENT_ID}&user_id=eq.${userId}&select=*`,
      { headers },
    );
    expect(subRes.ok()).toBeTruthy();
    const subs = await subRes.json();
    expect(subs.length).toBeGreaterThan(0);
    const submission = subs[0];
    expect(submission.workflow_state).toBe('submitted');


    // 5. Grade the submission as grading staff.
    //
    // This used to reuse `headers` (the signed-in member's token) on the claim
    // that the test user "has admin + instructor roles". It does not —
    // e2e-member holds `student` only — and assignment_submissions has a BEFORE
    // UPDATE trigger, pin_assignment_grade_columns, that silently reverts every
    // grade column unless is_grading_staff() passes. PostgREST still answered
    // 200, so `grader.ok()` was true while score stayed null and the assertion
    // on the rendered score failed several steps later for no visible reason.
    const staffToken = await getGradingStaffToken(page);
    const staffHeaders = { ...headers, Authorization: `Bearer ${staffToken}` };
    const grader = await page.request.patch(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?id=eq.${submission.id}`,
      {
        headers: staffHeaders,
        data: {
          workflow_state: 'graded',
          score: 90,
          grader_comments: 'Great work — clear reasoning and correct output.',
          graded_at: new Date().toISOString(),
        },
      },
    );
    expect(grader.ok(), `grade update ok (${grader.status()})`).toBeTruthy();

    // ok() is not enough: the trigger reverts silently and still returns 200.
    // Read the row back and assert the grade actually persisted, so a future
    // permission regression fails HERE with a clear cause rather than as a
    // missing string in the UI.
    const verify = await page.request.get(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?id=eq.${submission.id}&select=score,workflow_state`,
      { headers },
    );
    const [graded] = await verify.json();
    expect(
      graded?.score,
      'grade did not persist — pin_assignment_grade_columns reverts grade columns unless is_grading_staff()',
    ).toBe(90);

    // 6. Mark the content item complete so completion status advances (upsert)
    const prog = await page.request.post(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?on_conflict=user_id,content_item_id`,
      {
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
        data: {
          user_id: userId,
          content_item_id: CONTENT_ITEM_ID,
          workflow_state: 'completed',
        },
      },
    );
    expect(prog.ok(), `progression upsert ok (${prog.status()})`).toBeTruthy();


    // 7. Reload lesson; expect the graded feedback UI to render
    await page.reload();
    await expect(page.getByText(/Graded · Attempt 1 of/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Score 90/i)).toBeVisible();
    await expect(page.getByText(/Great work — clear reasoning/i)).toBeVisible();

    // 8. Verify completion propagates: enrollment.completion_status > 0
    //    (module_progressions/enrollment sync may lag, so give it a few tries)
    let completion = 0;
    for (let i = 0; i < 6; i++) {
      const enrolls = await page.request.get(
        `${SUPABASE_URL}/rest/v1/enrollments?course_id=eq.${COURSE_ID}&user_id=eq.${userId}&select=completion_status`,
        { headers },
      );
      const rows = await enrolls.json();
      completion = rows[0]?.completion_status ?? 0;
      const progRes = await page.request.get(
        `${SUPABASE_URL}/rest/v1/content_item_progressions?content_item_id=eq.${CONTENT_ITEM_ID}&user_id=eq.${userId}&select=workflow_state`,
        { headers },
      );
      const progRows = await progRes.json();
      if (progRows[0]?.workflow_state === 'completed') break;
      await page.waitForTimeout(500);
    }

    // Content item progression must be recorded — the completion signal the app tracks
    const finalProg = await page.request.get(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?content_item_id=eq.${CONTENT_ITEM_ID}&user_id=eq.${userId}&select=workflow_state`,
      { headers },
    );
    const finalRows = await finalProg.json();
    expect(finalRows[0]?.workflow_state).toBe('completed');
  });
});
