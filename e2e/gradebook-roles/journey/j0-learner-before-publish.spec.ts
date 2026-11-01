// ABOUTME: Journey J0 (UNRUN): before the instructor publishes, the learner cannot discover or open the draft course through
// ABOUTME: the UI. Each absence is paired with a positive control (the published control course renders) and a denial signal.
//
// Scope: a UI observation only. The enrollments INSERT policy in the schema snapshot checks only auth.uid() = user_id
// (F2, a snapshot policy gap, not observed at runtime); the journey does not probe the API (no API shortcuts).
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, route } from './ids';
import { expectCalls, recordCalls, shot } from './observe';

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
    await expectCalls(page, { method: 'GET', path: '/rest/v1/courses', query: { id: `eq.${J.course}` } }, async () => {
      await page.goto(route.detail);
      await waitForPageLoad(page);
    }, { count: 1, status: [406] });
    await expect(page.getByText('Failed to load course')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enroll for free/ })).toHaveCount(0);
    expect(rec.candidates({ method: 'POST', path: '/rest/v1/enrollments' }), 'no enrollment request started').toHaveLength(0);
  } finally { rec.stop(); }
  await shot(page, info, 'J0b-detail-before-publish');
});
