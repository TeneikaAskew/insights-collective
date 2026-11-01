// ABOUTME: Learner half of the gradebook real-role run: after the instructor saves, the learner sees 0/10 and 7/10 with
// ABOUTME: feedback across reloads, a self-write to grade/feedback is pinned (row unchanged), and another user's row
// ABOUTME: answers zero rows. Depends on the instructor project having finished.
import { test, expect } from '../fixtures/page-helpers';
import { waitForPageLoad } from '../fixtures/page-helpers';
import { GB, FEEDBACK, API_OK, patchAsPage, shot } from './fixture';

test.describe.configure({ mode: 'serial' });
test.skip(!API_OK, 'needs the local loopback API (VITE_SUPABASE_URL) and its anon key');

const lesson = (item: string) => `/courses/${GB.course}/learn/${GB.module}/${item}`;

for (const [key, score, feedback] of [['SG0', '0', FEEDBACK.SG0b], ['SG7', '7', FEEDBACK.SG7], ['GB0', '0', null], ['GB7', '7', null]] as const) {
  test(`L-${key}: learner sees Score ${score} / 10 after two fresh loads`, async ({ page }, info) => {
    for (let i = 0; i < 2; i++) {
      await page.goto(lesson(GB.item[key]));
      await waitForPageLoad(page);
      await expect(page.getByText(new RegExp(`Score ${score} / 10`)).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(/\/ 100/).filter({ visible: true })).toHaveCount(0);
      if (feedback) await expect(page.getByText(feedback).filter({ visible: true }).first()).toBeVisible();
    }
    await shot(page, info, `L-${key}-learner-${score}of10`);
  });
}

test('L-list: assignments list shows earned/10 for all four', async ({ page }, info) => {
  await page.goto(`/courses/${GB.course}/assignments`);
  await waitForPageLoad(page);
  for (const v of ['0/10 pts', '7/10 pts']) await expect(page.getByText(v).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/\/100 pts/).filter({ visible: true })).toHaveCount(0);
  await shot(page, info, 'L-list-assignments');
});

test('P1 learner self-write to own grade and feedback: one row back, grade and feedback unchanged (pinned)', async ({ page }) => {
  await page.goto(lesson(GB.item.SG7));
  await waitForPageLoad(page);
  const r = await patchAsPage(page, GB.sub.SG7, { grade: 10, grader_comments: 'self-graded' });
  expect(r.status).toBe(200);
  expect(r.rows).toHaveLength(1);
  expect(Number(r.rows![0].grade)).toBe(7);
  expect(String(r.rows![0].grader_comments)).toContain(FEEDBACK.SG7);
  expect(r.rows![0].workflow_state).toBe('graded');
});

test('Z2 learner PATCH on another user\'s submission: zero rows', async ({ page }) => {
  await page.goto(`/courses/${GB.course}/assignments`);
  await waitForPageLoad(page);
  const r = await patchAsPage(page, GB.sub.GX_ADMIN, { grade: 10 });
  expect(r.status).toBe(200);
  expect(r.rows).toEqual([]);
});
