// ABOUTME: Journey J3 (UNRUN): the instructor opens SpeedGrader for the learner's real submission, downloads the uploaded
// ABOUTME: file through Storage (bytes equal the upload, one audit RPC), grades 7 / 10 bound to the known submission id, reloads.
//
// The file comes back through supabase.storage.download (GET /storage/v1/object/course-documents/<key>) under the
// instructor's session, so the course_submission_select policy is what lets it through. No signed URL is created, logged or
// attached. The submission id, attachment id and object key come from J2c's private run state, never from a query here.
import fs from 'node:fs';
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { GRADE, POINTS, FEEDBACK, STORED_FEEDBACK, UPLOAD, route } from './ids';
import { expectCalls, expectCallSet, loadRunState, rowsOf, sameInstant, sha256, shot } from './observe';

test.describe.configure({ mode: 'serial' });

async function openGrader(page: import('@playwright/test').Page) {
  await page.goto(route.grader);
  await waitForPageLoad(page);
  await expect(page.locator('#grade')).toBeVisible();
  await expect(page.getByText(`/ ${POINTS}`, { exact: false }).first()).toBeVisible();
}

test('J3a SpeedGrader Download: one audit RPC for this submission and attachment, one Storage GET of the exact key, bytes equal the upload', async ({ page }, info) => {
  const s = loadRunState();
  await openGrader(page);
  await expect(page.getByText(UPLOAD.name).filter({ visible: true }).first()).toBeVisible();
  const dlP = page.waitForEvent('download', { timeout: 30_000 });
  const [[rpc], [get]] = await expectCallSet(page, [
    { spec: { method: 'POST', path: '/rest/v1/rpc/log_submission_file_access' }, count: 1, status: [200, 204] },
    { spec: { method: 'GET', path: `/storage/v1/object/course-documents/${s.attachmentKey}` }, count: 1, status: [200] },
  ], () => page.getByRole('button', { name: /Download/ }).first().click());
  const args = rpc.req.postDataJSON();
  expect(args).toEqual({ p_submission_id: s.submissionId, p_action: 'file_downloaded', p_attachment_id: s.attachmentId, p_filename: UPLOAD.name });
  expect(get.url.search, 'plain authenticated download, no transform or token').toBe('');
  const dl = await dlP;
  expect(dl.suggestedFilename()).toBe(UPLOAD.name);
  const path = await dl.path();
  expect(path, 'download completed').toBeTruthy();
  expect(sha256(fs.readFileSync(path!))).toBe(sha256(UPLOAD.body()));
  await shot(page, info, 'J3a-speedgrader-with-file');
});

test(`J3b SpeedGrader: grade ${GRADE} / ${POINTS} with feedback; one PATCH id=eq.<known submission>, same id and graded_at back, reload readback`, async ({ page }, info) => {
  const s = loadRunState();
  await openGrader(page);
  await page.locator('#grade').fill(String(GRADE));
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(FEEDBACK);

  const [call] = await expectCalls(page, { method: 'PATCH', path: '/rest/v1/assignment_submissions', query: { id: `eq.${s.submissionId}` } },
    () => page.getByRole('button', { name: /^Save$/ }).click(), { count: 1, status: [200] });
  const sent = call.req.postDataJSON();
  expect(Object.keys(sent).sort()).toEqual(['grade', 'graded_at', 'grader_comments', 'workflow_state']);
  expect(Number(sent.grade)).toBe(GRADE);
  expect(sent.grader_comments).toBe(STORED_FEEDBACK);
  expect(sent.workflow_state).toBe('graded');
  const rows = await rowsOf(call);
  expect(rows).toHaveLength(1);
  expect(rows[0].id, 'the returned row is the known learner submission').toBe(s.submissionId);
  expect(Number(rows[0].grade)).toBe(GRADE);
  expect(rows[0].grader_comments).toBe(STORED_FEEDBACK);
  expect(rows[0].workflow_state).toBe('graded');
  expect(sameInstant(rows[0].graded_at, sent.graded_at), 'graded_at persisted as the instant the app sent').toBe(true);
  await expect(page.getByText('Grade published').first()).toBeVisible();

  await openGrader(page);
  await expect(page.locator('#grade')).toHaveValue(String(GRADE));
  await expect(page.locator('[contenteditable="true"]').first()).toHaveText(FEEDBACK);
  await shot(page, info, 'J3b-speedgrader-graded-after-reload');
});
