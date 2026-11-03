// ABOUTME: Learner persona (e2e-member, enrolled in RR): both tabs are denied with no classmate data on the page, and the
// ABOUTME: API returns only the learner's own enrollment and progression rows.
import { test, expect, apiAsPage } from './guarded-test';
import { builder, FIXTURE_LEARNERS, RR } from './expected';

for (const [id, view] of [['RR-L1', 'students'], ['RR-L2', 'reports']] as const) {
  test(`${id} ${view} tab is denied to a learner, with no classmate names on the page`, async ({ page }) => {
    await page.goto(builder(RR.course, view));
    await expect(page.getByRole('heading', { name: 'Not authorized' })).toBeVisible();
    for (const l of FIXTURE_LEARNERS) await expect(page.getByText(l.name)).toHaveCount(0);
  });
}

test('RR-L3 API returns only the learner\'s own rows for the course', async ({ page }) => {
  await page.goto('/');
  const enr = await apiAsPage(page, `enrollments?course_id=eq.${RR.course}&select=id,user_id`);
  expect(enr).toEqual([{ id: RR.memberEnrollment, user_id: RR.memberId }]);
  const ids = Object.values(RR.item).join(',');
  const prog = await apiAsPage(page, `content_item_progressions?content_item_id=in.(${ids})&select=id,user_id&order=id`);
  expect(prog.map((p) => p.id)).toEqual([...RR.memberProgressions]);
  expect(prog.every((p) => p.user_id === RR.memberId)).toBe(true);
});
