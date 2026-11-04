// ABOUTME: Journey J0 (UNRUN): before the instructor publishes, the learner cannot discover or open the draft course through
// ABOUTME: the UI. Each absence is paired with a positive control (the published control course renders) and a denial signal.
//
// Scope: a UI observation only. The enrollments INSERT policy in the schema snapshot checks only auth.uid() = user_id
// (F2, a snapshot policy gap, not observed at runtime); the journey does not probe the API (no API shortcuts).
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, route } from './ids';
import { expectCallSet, recordCalls, shot } from './observe';

// Independent read-only checks: one failing does not skip the other.

test('J0a catalog settled: the published control course is listed, the draft course is not', async ({ page }, info) => {
  await page.goto(route.catalog);
  await waitForPageLoad(page);
  await expect(page.getByText(J.control.title, { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText(J.title.course, { exact: true })).toHaveCount(0);
  await shot(page, info, 'J0a-catalog-before-publish');
});

test('J0b detail: the control course renders; the draft course read returns zero rows (406) and the error state, with no enrollment request', async ({ page }, info) => {
  await page.goto(`/courses/${J.control.course}`);
  await waitForPageLoad(page);
  await expect(page.getByRole('heading', { name: J.control.title }).first()).toBeVisible();

  const rec = recordCalls(page);
  try {
    // The detail route mounts THREE independent readers of the course row, each the same request (select course + instructor,
    // id=eq.<course>, .single(), so zero visible rows is HTTP 406): CourseDetail.fetchCourseData, CourseSidebar
    // (CourseLayout) via useCourseData, and ProfileMenu (Navbar) via useCourseData. Each mounts once, so exactly 3, each 406.
    // The Navbar's SiteSearch also reads the published-course list (published=eq.true): declared here, so that read is
    // counted and status-checked as itself instead of being an undeclared near miss of the draft read.
    await expectCallSet(page, [
      { spec: { method: 'GET', path: '/rest/v1/courses', query: { id: `eq.${J.course}` } }, count: 3, status: [406] },
      { spec: { method: 'GET', path: '/rest/v1/courses', query: { published: 'eq.true' } }, count: 1, status: [200] },
    ], async () => {
      await page.goto(route.detail);
      await waitForPageLoad(page);
    });
    // The page's error state (CourseErrorState: role=alert, AlertTitle heading). Not getByText: CourseDetail also raises a
    // toast titled "Failed to load course" (plus Radix's announce copy), and the course sidebar and profile menu each raise
    // an "Error" toast; use-toast keeps ONE toast (TOAST_LIMIT 1), so whether the matching toast is still on screen depends on
    // which of the three 406 responses lands last, and a page-wide text match is then ambiguous (strict mode) or not.
    await expect(page.getByRole('alert').filter({ has: page.getByRole('heading', { name: 'Failed to load course', exact: true }) })).toBeVisible();
    await expect(page.getByRole('button', { name: /Enroll for free/ })).toHaveCount(0);
    expect(rec.candidates({ method: 'POST', path: '/rest/v1/enrollments' }), 'no enrollment request started').toHaveLength(0);
  } finally { rec.stop(); }
  await shot(page, info, 'J0b-detail-before-publish');
});
