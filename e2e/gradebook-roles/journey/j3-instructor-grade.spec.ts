// ABOUTME: Journey J3 (UNRUN): the instructor opens SpeedGrader for the learner's real submission, downloads the uploaded
// ABOUTME: file through Storage (bytes must equal what was uploaded), grades 7 / 10 with feedback, and reads it back after a reload.
//
// The file comes back through supabase.storage.download under the instructor's session, so the course_submission_select
// policy (can_manage_course_materials on segment 2) is what lets it through. No signed URL is created, logged or attached.
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, GRADE, POINTS, FEEDBACK, STORED_FEEDBACK, UPLOAD, route } from './ids';
import { sha256, shot } from './observe';

test.describe.configure({ mode: 'serial' });

async function openGrader(page: import('@playwright/test').Page) {
  await page.goto(route.grader);
  await waitForPageLoad(page);
  await expect(page.locator('#grade')).toBeVisible();
  await expect(page.getByText(`/ ${POINTS}`, { exact: false }).first()).toBeVisible();
}

test('J3a SpeedGrader shows the learner file and its Storage download is byte-identical to the upload', async ({ page }, info) => {
  await openGrader(page);
  await expect(page.getByText(UPLOAD.name).filter({ visible: true }).first()).toBeVisible();
  const dlP = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: /Download/ }).first().click();
  const dl = await dlP;
  expect(dl.suggestedFilename()).toBe(UPLOAD.name);
  const path = await dl.path();
  expect(path, 'download completed').toBeTruthy();
  const bytes = (await import('node:fs')).readFileSync(path!);
  expect(sha256(bytes)).toBe(sha256(UPLOAD.body()));
  await shot(page, info, 'J3a-speedgrader-with-file');
});

test(`J3b SpeedGrader: grade ${GRADE} / ${POINTS} with feedback; exact request, one returned row, reload readback`, async ({ page }, info) => {
  await openGrader(page);
  await page.locator('#grade').fill(String(GRADE));
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(FEEDBACK);

  const resP = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/rest/v1/assignment_submissions'), { timeout: 30_000 });
  await page.getByRole('button', { name: /^Save$/ }).click();
  const res = await resP;
  const sent = res.request().postDataJSON();
  expect(Number(sent.grade)).toBe(GRADE);
  expect(sent.grader_comments).toBe(STORED_FEEDBACK);
  expect(sent.workflow_state).toBe('graded');
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows).toHaveLength(1);
  expect(rows[0].user_id ?? J.memberId).toBe(J.memberId);
  expect(Number(rows[0].grade)).toBe(GRADE);
  expect(rows[0].grader_comments).toBe(STORED_FEEDBACK);
  expect(rows[0].workflow_state).toBe('graded');
  await expect(page.getByText('Grade published').first()).toBeVisible();

  await openGrader(page);
  await expect(page.locator('#grade')).toHaveValue(String(GRADE));
  await expect(page.locator('[contenteditable="true"]').first()).toHaveText(FEEDBACK);
  await shot(page, info, 'J3b-speedgrader-graded-after-reload');
});
