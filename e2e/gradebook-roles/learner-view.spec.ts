// ABOUTME: Learner half of the gradebook real-role run: every learner route shows each assignment's own score out of 10 by
// ABOUTME: identity across fresh loads; the learner's own writes to grade, feedback (same grade), graded_at are pinned;
// ABOUTME: workflow_state is recorded as current behaviour; another user's row answers zero rows.
import { test, expect } from '../fixtures/page-helpers';
import { waitForPageLoad } from '../fixtures/page-helpers';
import { GB, FINAL, FEEDBACK, STORED, num, sameInstant, patchAsPage, readAsPage, shot } from './fixture';

test.describe.configure({ mode: 'serial' });
const lesson = (item: string) => `/courses/${GB.course}/learn/${GB.module}/${item}`;
const FEEDBACK_SHOWN: Record<string, string | null> = { SG0: FEEDBACK.SG0b, SG7: FEEDBACK.SG7, GB0: null, GB7: null };

for (const key of ['SG0', 'SG7', 'GB0', 'GB7'] as const) {
  test(`L-${key}: lesson route shows "${GB.title[key]}" with Score ${FINAL[key]} / 10 across two fresh loads`, async ({ page }, info) => {
    for (let i = 0; i < 2; i++) {
      await page.goto(lesson(GB.item[key]));
      await waitForPageLoad(page);
      await expect(page.getByText(GB.title[key]).filter({ visible: true }).first()).toBeVisible();
      const status = page.getByText(/Score \d+ \/ \d+/).filter({ visible: true });
      await expect(status).toHaveCount(1);
      await expect(status).toContainText(`Score ${FINAL[key]} / 10`);
      if (FEEDBACK_SHOWN[key]) await expect(page.getByText(FEEDBACK_SHOWN[key]!).filter({ visible: true }).first()).toBeVisible();
    }
    await shot(page, info, `L-${key}-lesson-${FINAL[key]}of10`);
  });
}

test('L-grades: the course grades route lists each assignment by title with its own N / 10', async ({ page }, info) => {
  for (let i = 0; i < 2; i++) {
    await page.goto(`/courses/${GB.course}/grades`);
    await waitForPageLoad(page);
    const list = page.getByTestId('course-grades-list').filter({ visible: true });
    await expect(list).toBeVisible();
    for (const key of ['SG0', 'SG7', 'GB0', 'GB7'] as const) {
      const row = list.locator(':scope > div').filter({ hasText: GB.title[key] });
      await expect(row, `one grades row for ${key}`).toHaveCount(1);
      await expect(row.locator('span.tabular-nums')).toHaveText(new RegExp(`^\\s*${FINAL[key]}\\s*/\\s*10\\s*$`));
    }
  }
  await shot(page, info, 'L-grades-route');
});

test('L-list: the assignments route shows each assignment by title with its own N/10 pts', async ({ page }, info) => {
  await page.goto(`/courses/${GB.course}/assignments`);
  await waitForPageLoad(page);
  for (const key of ['SG0', 'SG7', 'GB0', 'GB7'] as const) {
    const card = page.locator('div').filter({ has: page.getByText(GB.title[key], { exact: true }) }).filter({ hasText: /pts/ }).filter({ visible: true }).last();
    await expect(card).toContainText(`${FINAL[key]}/10 pts`);
  }
  await expect(page.getByText(/\/100 pts/).filter({ visible: true })).toHaveCount(0);
  await shot(page, info, 'L-list-assignments');
});

// API controls on the learner's OWN rows. Each reads the row before and after through the same API.
test('P1 own SG7: grade + feedback rewrite is pinned (one row back, unchanged)', async ({ page }) => {
  await page.goto(lesson(GB.item.SG7)); await waitForPageLoad(page);
  const before = await readAsPage(page, GB.sub.SG7);
  const r = await patchAsPage(page, GB.sub.SG7, { grade: 10, grader_comments: 'self-graded' });
  expect(r.status).toBe(200); expect(r.rows).toHaveLength(1);
  expect(num(r.rows![0].grade, 'grade')).toBe(FINAL.SG7);
  expect(r.rows![0].grader_comments).toBe(STORED(FEEDBACK.SG7));
  expect(await readAsPage(page, GB.sub.SG7)).toEqual(before);
});
test('P2 own SG7: SAME grade, feedback-only change is pinned', async ({ page }) => {
  await page.goto(lesson(GB.item.SG7)); await waitForPageLoad(page);
  const before = await readAsPage(page, GB.sub.SG7);
  const r = await patchAsPage(page, GB.sub.SG7, { grade: FINAL.SG7, grader_comments: 'self feedback' });
  expect(r.status).toBe(200); expect(r.rows).toHaveLength(1);
  expect(r.rows![0].grader_comments).toBe(STORED(FEEDBACK.SG7));
  expect(await readAsPage(page, GB.sub.SG7)).toEqual(before);
});
test('P3 own SG7: graded_at rewrite is pinned', async ({ page }) => {
  await page.goto(lesson(GB.item.SG7)); await waitForPageLoad(page);
  const before = await readAsPage(page, GB.sub.SG7);
  const r = await patchAsPage(page, GB.sub.SG7, { graded_at: '2020-01-01T00:00:00Z' });
  expect(r.status).toBe(200); expect(r.rows).toHaveLength(1);
  expect(sameInstant(r.rows![0].graded_at, before.graded_at)).toBe(true);
  expect(await readAsPage(page, GB.sub.SG7)).toEqual(before);
});
test('P4 own GX row: workflow_state is NOT pinned by pin_assignment_grade_columns (CURRENT BEHAVIOUR, not policy); grade stays NULL', async ({ page }) => {
  await page.goto(`/courses/${GB.course}/assignments`); await waitForPageLoad(page);
  const before = await readAsPage(page, GB.sub.GX_MEMBER);
  expect(before.workflow_state).toBe('submitted');
  const r = await patchAsPage(page, GB.sub.GX_MEMBER, { workflow_state: 'graded', grade: 10 });
  expect(r.status).toBe(200); expect(r.rows).toHaveLength(1);
  expect(r.rows![0].workflow_state).toBe('graded');     // the pin function's source lists no workflow_state
  expect(r.rows![0].grade).toBeNull();                  // grade IS pinned
  expect(r.rows![0].graded_at).toBeNull();
});
test('Z2 another user\'s submission answers zero rows', async ({ page }) => {
  await page.goto(`/courses/${GB.course}/assignments`); await waitForPageLoad(page);
  const r = await patchAsPage(page, GB.sub.GX_ADMIN, { grade: 10 });
  expect(r.status).toBe(200);
  expect(r.rows).toEqual([]);
});
