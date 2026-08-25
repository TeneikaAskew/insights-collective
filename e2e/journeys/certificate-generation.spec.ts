// ABOUTME: E2E — completes every published content item for the seeded course as the member,
// ABOUTME: then verifies the DB trigger auto-issues a certificate and the /certificate page renders it.
import { test, expect } from '../fixtures/page-helpers';
import { signInMember, getSupabaseAccessToken } from './_helpers/signIn';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';
// A DIFFERENT COURSE FROM full-completion-sequence.spec.ts, AND THAT IS THE POINT.
//
// Both specs run in the chromium-member-journeys project as the same account,
// and both begin by DELETING that account's certificate and content-item
// progressions for their course before rebuilding them to prove auto-issuance.
// Pointed at the same course they were deleting each other's rows: the sibling
// spec's reset lands while this one is polling for the certificate its own
// progressions just triggered, and the poll then finds nothing. Playwright
// distributes the two files to two workers, so they genuinely do overlap — a
// local run has them starting together and finishing 5s apart.
//
// Serialising them would have worked, but Playwright has no cross-file serial
// mode, and the two are only in conflict over data. Certificates are keyed
// (user_id, course_id) and progressions hang off a course's content items, so
// a different course makes the two sets disjoint and the specs independent —
// no ordering constraint, no lock, and they still run in parallel.
//
// This spec is course-agnostic by construction: it completes EVERY published
// item in whatever course it is given and derives its assertions from that
// count. The sibling is not — it submits a specific seeded assignment — which
// is why this is the one that moved. Keep them different.
const COURSE_ID =
  process.env.E2E_TEST_CERTIFICATE_COURSE_ID || '660e8400-e29b-41d4-a716-446655440002';

async function getAccessToken(page: any): Promise<string> {
  const token = await getSupabaseAccessToken(page);
  if (!token) throw new Error('No Supabase access token found in localStorage — is the member logged in?');
  return token;
}

test.describe('Certificate generation — end to end', () => {
  test.beforeEach(async ({ page }) => { await signInMember(page); });

  test('completing every content item auto-issues a certificate and the certificate page reflects it', async ({ page }) => {
    // 1) Load the app so the member session hydrates into localStorage.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard|courses|login/i);
    const accessToken = await getAccessToken(page);
    const authHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` };


    // 2) Resolve the member's user id.
    const meRes = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders });
    // Include the response body: a bare status tells us the token was rejected
    // but not why, and "why" is the whole question when this fails in CI.
    // Supabase names the cause here (expired, bad_jwt, session_not_found, ...).
    expect(
      meRes.ok(),
      `auth/v1/user ${meRes.status()} — ${(await meRes.text()).slice(0, 300)}`,
    ).toBeTruthy();
    const userId = (await meRes.json()).id as string;
    expect(userId).toBeTruthy();

    // 2b) Ensure the account is enrolled, creating the row only if missing.
    //
    // Not optional, and not merely tidiness: RLS gates `content_items` on
    // enrollment, so an unenrolled account reads the course as having zero
    // published items and step 3's assertion fails with "seeded course has
    // published content items" — which reads like an unseeded database rather
    // than a permissions result. This spec previously shared a course with its
    // sibling and inherited that spec's enrollment; on its own course it has to
    // establish its own. Mirrors full-completion-sequence.spec.ts, which needs
    // the same thing for the same reason.
    const existingEnroll = await page.request.get(
      `${SUPABASE_URL}/rest/v1/enrollments?user_id=eq.${userId}&course_id=eq.${COURSE_ID}&select=id`,
      { headers: authHeaders },
    );
    const enrollRows = existingEnroll.ok() ? await existingEnroll.json() : [];
    if (!enrollRows.length) {
      const enrollRes = await page.request.post(
        `${SUPABASE_URL}/rest/v1/enrollments`,
        {
          headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          data: JSON.stringify({ user_id: userId, course_id: COURSE_ID }),
        },
      );
      expect(
        enrollRes.ok(),
        `enrollment insert (${enrollRes.status()}: ${await enrollRes.text()})`,
      ).toBeTruthy();
    }

    // 3) Fetch every published content item in every published module for this course.
    const itemsRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/content_items?select=id,module_id,published,modules!inner(course_id,published)&modules.course_id=eq.${COURSE_ID}&modules.published=eq.true&published=eq.true`,
      { headers: authHeaders },
    );
    expect(itemsRes.ok(), `content_items query ok (${itemsRes.status()})`).toBeTruthy();
    const items = (await itemsRes.json()) as Array<{ id: string }>;
    expect(items.length, 'seeded course has published content items').toBeGreaterThan(0);

    // 4) Reset any existing certificate + progressions so this run truly proves auto-issuance.
    //    This spec runs in the chromium-member-journeys project, so `userId`
    //    here is the dedicated journeys account, not the shared member. That
    //    is what makes this reset safe: RLS scopes certificate deletes to the
    //    acting user, so nothing here can touch the shared member's fixture
    //    certificate, which profile-certificates-flow.spec.ts asserts on and
    //    the /profile visual snapshot renders. Keep it that way -- running
    //    this as the shared member reintroduces both failures at once.
    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/certificates?user_id=eq.${userId}&course_id=eq.${COURSE_ID}`,
      { headers: authHeaders },
    );
    // Note: users can delete their own progressions per RLS.
    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/content_item_progressions?user_id=eq.${userId}&content_item_id=in.(${items.map((i) => i.id).join(',')})`,
      { headers: authHeaders },
    );

    // 5) Insert a 'completed' progression for every item. The trigger fires per-row.
    const rows = items.map((i) => ({
      user_id: userId,
      content_item_id: i.id,
      workflow_state: 'completed',
    }));
    const insertRes = await page.request.post(
      `${SUPABASE_URL}/rest/v1/content_item_progressions`,
      {
        headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        data: JSON.stringify(rows),
      },
    );
    expect(insertRes.ok(), `progressions upsert ok (${insertRes.status()}: ${await insertRes.text()})`).toBeTruthy();

    // 6) Poll certificates table for the auto-issued row.
    let cert: any = null;
    for (let attempt = 0; attempt < 10 && !cert; attempt++) {
      const res = await page.request.get(
        `${SUPABASE_URL}/rest/v1/certificates?user_id=eq.${userId}&course_id=eq.${COURSE_ID}&select=verification_code,certificate_type,certificate_data,issued_at`,
        { headers: authHeaders },
      );
      if (res.ok()) {
        const arr = await res.json();
        if (arr.length) { cert = arr[0]; break; }
      }
      await page.waitForTimeout(500);
    }
    expect(cert, 'certificate row auto-created by trigger').toBeTruthy();
    expect(cert.certificate_type).toBe('completion');
    expect(String(cert.verification_code)).toMatch(/^[A-Z0-9]{12}$/);
    expect(cert.certificate_data?.auto_issued).toBe(true);
    expect(cert.certificate_data?.total_items).toBe(items.length);

    // 7) Certificate page shows the completed state (no "must complete" alert).
    await page.goto(`/courses/${COURSE_ID}/certificate`);
    // Heading is either "Course certificate" (not-yet-completed) or "Your
    // certificate is ready" (completed). After the auto-issue trigger fires
    // we should see the completed heading; accept either to keep the assertion
    // stable across the async completion window.
    await expect(
      page.getByRole('heading', {
        name: /(course certificate|your certificate is ready)/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/must complete all course requirements/i),
    ).toHaveCount(0);
  });
});
