// ABOUTME: Covers /courses/:courseId/insights/:studentId for an instructor viewing
// ABOUTME: an enrolled student — the one place the app reads another user's profile
// ABOUTME: row, which RLS (can_view_profile) has to allow for the name to appear.
import { test, expect } from '../fixtures/page-helpers';
import { E2E_BASE_URL, FIXTURE_COURSES } from '../fixtures/test-data';
import { getSupabaseAccessToken } from '../journeys/_helpers/signIn';

/**
 * Runs under chromium-instructor (e2e/instructor/** is matched by that project),
 * signed in as the account that owns FIXTURE_COURSES.enrolled.
 *
 * The assertion that earns this spec is the student's *name*. The dashboard
 * reads it from profiles for a user who is not the viewer, so it is the only
 * screen where can_view_profile() is exercised across accounts. The page still
 * renders when that policy stops covering it — StudentInsightsDashboard reads
 * the profile with .maybeSingle(), so a blocked read yields null and the
 * subtitle carrying the name disappears rather than erroring — which a
 * shell-level check would sail straight past.
 *
 * The expected name is resolved from the API at run time rather than hard-coded.
 * profiles.first_name/last_name are user-editable and this suite runs against a
 * shared live project, so a literal would fail whenever someone renamed the
 * fixture account, for a reason having nothing to do with the policy under test.
 * Same ground-truth approach as e2e/admin/admin-instructor-roster.spec.ts.
 */
const COURSE = FIXTURE_COURSES.enrolled;
const STUDENT_ID = process.env.E2E_MEMBER_USER_ID || '575f018c-fa13-4e36-959f-7aba223b1e53';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

test.describe('Instructor viewing student insights', () => {
  test("renders the student's own analytics, including their profile name", async ({ page }) => {
    expect(
      SUPABASE_KEY,
      'VITE_SUPABASE_PUBLISHABLE_KEY must be set to resolve the expected student name',
    ).toBeTruthy();

    await page.goto(`${E2E_BASE_URL}/courses/${COURSE.id}/insights/${STUDENT_ID}`, {
      waitUntil: 'domcontentloaded',
    });

    // Instructor must clear the role guard on StudentInsights.
    await expect(page.getByText(/don't have permission to view this student/i)).toHaveCount(0, {
      timeout: 15_000,
    });

    await expect(page.getByText(/failed to load student insights/i)).toHaveCount(0);
    await expect(page.getByText(/unable to load student insights/i)).toHaveCount(0);

    await expect(
      page.getByRole('heading', { name: /student performance dashboard/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Ground truth for the cross-account profile read, fetched with the
    // instructor's own session so it goes through can_view_profile() exactly as
    // the app's query does.
    const token = await getSupabaseAccessToken(page);
    expect(token, 'instructor session token present').toBeTruthy();

    const res = await page.request.get(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${STUDENT_ID}&select=first_name,last_name`,
      { headers: { apikey: SUPABASE_KEY!, Authorization: `Bearer ${token}` } },
    );
    expect(res.ok(), `profiles query ok (${res.status()}: ${await res.text()})`).toBeTruthy();

    const rows = (await res.json()) as Array<{ first_name: string | null; last_name: string | null }>;
    const expectedName = [rows[0]?.first_name, rows[0]?.last_name].filter(Boolean).join(' ').trim();

    // This is the RLS assertion, and it is deliberately separate from the render
    // check below: if can_view_profile() stopped covering "instructor of a course
    // this student is enrolled in", the row would come back empty here and an
    // empty expectation would otherwise match an empty page vacuously.
    expect(
      expectedName,
      'instructor can read the enrolled student\'s profile name via can_view_profile()',
    ).not.toBe('');

    // ...and the dashboard must actually render that name.
    await expect(page.getByText(expectedName).filter({ visible: true }).first()).toBeVisible();

    // Rendered in the same subtitle, so it also confirms the course resolved.
    await expect(page.getByText(COURSE.title).first()).toBeVisible();

    // Metric cards prove the per-student aggregation ran for the *target*
    // student rather than falling back to the signed-in instructor.
    await expect(page.getByText(/overall progress/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/module completion/i).filter({ visible: true }).first()).toBeVisible();
  });
});
