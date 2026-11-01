// ABOUTME: Journey J2 (UNRUN): the learner finds the now-published course, enrolls with the UI control, reads the page lesson,
// ABOUTME: then uploads a real file and submits. Every write is the app's own request, matched at request level (start + terminal).
//
// Writes, all under the learner's session through the real API, Storage and RLS: enrollment INSERT; page progression upsert
// (markContentItemAsRead, workflow_state 'read'); Storage object POST into submissions/<course>/<learner>/
// (course_submission_insert policy); submission INSERT; attachment INSERT; assignment progression upsert (also 'read',
// accepted by enforce_assessed_progression only with final evidence).
//
// Certificate claim, scoped: ONLY on the composed-r5 stack (session setup refuses anything else), where the exact pinned
// 000500/000600 issuer accepts a final 'submitted' row with submitted_at plus two 'read' progressions and applies no score
// threshold, the certificate exists right after submission. That is NOT the baseline #139 behaviour. J2c proves issuance
// with the app's own certificate SELECT (the issued card), never with a page heading, and records id, code and issued_at
// so J4d can require the same three values after grading.
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, UPLOAD, SUBMISSION_PREFIX, PROGRESS, route } from './ids';
import { expectCalls, expectCallSet, recordCalls, rowsOf, saveRunState, shot } from './observe';
import { expectProgress } from './progress-oracle';

test.describe.configure({ mode: 'serial' });

const certRead = { method: 'GET', path: '/rest/v1/certificates', query: { user_id: `eq.${J.memberId}`, course_id: `eq.${J.course}` } } as const;
const progUpsert = { method: 'POST', path: '/rest/v1/content_item_progressions', query: { on_conflict: 'user_id,content_item_id' } } as const;

test('J2a catalog -> detail -> Enroll: one enrollment POST for this learner and course; reload shows Continue learning', async ({ page }, info) => {
  await page.goto(route.catalog);
  await waitForPageLoad(page);
  const card = page.getByText(J.title.course, { exact: true }).filter({ visible: true });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/courses/${J.course}$`));
  await waitForPageLoad(page);

  const [call] = await expectCalls(page, { method: 'POST', path: '/rest/v1/enrollments' }, () => page.getByRole('button', { name: /Enroll for free/ }).click(), { count: 1, status: [201] });
  const sent = call.req.postDataJSON();
  expect(sent.user_id).toBe(J.memberId);
  expect(sent.course_id).toBe(J.course);
  await expect(page.getByText('Successfully enrolled!').first()).toBeVisible();

  await page.goto(route.detail);
  await waitForPageLoad(page);
  await expect(page.getByRole('link', { name: 'Continue learning' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Enroll for free/ })).toHaveCount(0);
  await shot(page, info, 'J2a-enrolled-after-reload');
});

test('J2b page lesson: exactly one read progression for the page; progress 50% (1 of 1 lessons, 0 of 1 assignments); no certificate row', async ({ page }, info) => {
  // Armed BEFORE navigation: on a short page the scroll sentinel is visible at once and fires about 1.5 s later.
  const [call] = await expectCalls(page, progUpsert, async () => {
    await page.goto(route.lesson(J.item.page));
    await waitForPageLoad(page);
    await expect(page.getByText(J.title.page).filter({ visible: true }).first()).toBeVisible();
    await page.mouse.wheel(0, 20_000);
  }, { count: 1, status: [200, 201] });
  const sent = call.req.postDataJSON();
  expect(sent.content_item_id).toBe(J.item.page);
  expect(sent.user_id).toBe(J.memberId);
  expect(sent.workflow_state).toBe('read');

  await expectProgress(page, PROGRESS.afterPage);
  await shot(page, info, 'J2b-progress-after-page');

  const [read] = await expectCalls(page, certRead, async () => { await page.goto(route.certificate); await waitForPageLoad(page); }, { count: 1, status: [200] });
  expect(await rowsOf(read), 'no certificate before the assignment is submitted').toHaveLength(0);
  await shot(page, info, 'J2b-certificate-none-after-page');
});

test('J2c assignment: Storage upload under the learner prefix, one submission, one attachment, one progression; 100%; certificate issued (composed-r5)', async ({ page }, info) => {
  // Opening and scrolling the assessed item must not complete it: no progression request STARTS without a submission.
  const rec = recordCalls(page);
  try {
    await page.goto(route.lesson(J.item.assignment));
    await waitForPageLoad(page);
    await expect(page.getByText(J.title.assignment).filter({ visible: true }).first()).toBeVisible();
    await page.mouse.wheel(0, 20_000);
    await page.waitForTimeout(2_500);
    expect(rec.candidates({ method: 'POST', path: '/rest/v1/content_item_progressions' }), 'no progression request from viewing an assignment').toHaveLength(0);
  } finally { rec.stop(); }

  await page.locator('input[type="file"]').first().setInputFiles({ name: UPLOAD.name, mimeType: UPLOAD.mimeType, buffer: UPLOAD.body() });

  const [[up], [sub], [att], [prog]] = await expectCallSet(page, [
    { spec: { method: 'POST', path: `/storage/v1/object/course-documents/${SUBMISSION_PREFIX}` }, count: 1, status: [200] },
    { spec: { method: 'POST', path: '/rest/v1/assignment_submissions' }, count: 1, status: [201] },
    { spec: { method: 'POST', path: '/rest/v1/submission_attachments' }, count: 1, status: [201] },
    { spec: progUpsert, count: 1, status: [200, 201] },
  ], () => page.getByRole('button', { name: /Submit/ }).click());

  const key = decodeURIComponent(up.url.pathname.slice('/storage/v1/object/course-documents/'.length));
  expect(key.startsWith(SUBMISSION_PREFIX)).toBe(true);
  expect(key.slice(SUBMISSION_PREFIX.length)).toMatch(/^\d+-[a-z0-9]+\.pdf$/);

  const sentSub = sub.req.postDataJSON();
  expect(sentSub.assignment_id).toBe(J.assignment);
  expect(sentSub.user_id).toBe(J.memberId);
  expect(sentSub.workflow_state).toBe('submitted');
  expect(sentSub.attempt).toBe(1);
  expect(sentSub.submission_type).toBe('online_upload');
  const subRows = await rowsOf(sub);
  expect(subRows).toHaveLength(1);
  const submissionId = String(subRows[0].id);
  expect(subRows[0].user_id).toBe(J.memberId);
  expect(subRows[0].assignment_id).toBe(J.assignment);
  expect(subRows[0].workflow_state).toBe('submitted');
  expect(subRows[0].grade ?? null).toBeNull();

  const attRows = await rowsOf(att);
  expect(attRows).toHaveLength(1);
  expect(att.req.postDataJSON()[0].submission_id).toBe(submissionId);
  expect(attRows[0].filename).toBe(UPLOAD.name);
  expect(attRows[0].url, 'attachment row stores the uploaded object key, not a URL').toBe(key);
  expect(attRows[0].size).toBe(UPLOAD.body().length);

  const sentProg = prog.req.postDataJSON();
  expect(sentProg.content_item_id).toBe(J.item.assignment);
  expect(sentProg.user_id).toBe(J.memberId);
  expect(sentProg.workflow_state).toBe('read');
  await expect(page.getByText('Assignment submitted').first()).toBeVisible();

  // Fresh load: state comes from the database, not component state.
  await page.goto(route.lesson(J.item.assignment));
  await waitForPageLoad(page);
  await expect(page.getByText(/Submitted · Attempt 1/).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText(UPLOAD.name).filter({ visible: true }).first()).toBeVisible();
  await shot(page, info, 'J2c-submitted-after-reload');

  await expectProgress(page, PROGRESS.afterSubmit);
  await shot(page, info, 'J2c-progress-after-submit');

  // Issuance proof BEFORE grading: the app's own scoped certificate SELECT returns exactly one row for this learner and
  // course, and the issued card shows its code. A heading alone is not proof.
  const [read] = await expectCalls(page, certRead, async () => { await page.goto(route.certificate); await waitForPageLoad(page); }, { count: 1, status: [200] });
  const certs = await rowsOf(read);
  expect(certs).toHaveLength(1);
  expect(certs[0].user_id).toBe(J.memberId);
  expect(certs[0].course_id).toBe(J.course);
  const code = String(certs[0].verification_code);
  expect(code).toMatch(/^[0-9A-F]{12}$/);
  await expect(page.getByText(code, { exact: true }).filter({ visible: true })).toHaveCount(1);
  await shot(page, info, 'J2c-certificate-issued-before-grade');

  saveRunState({
    submissionId, attachmentId: String(attRows[0].id), attachmentKey: key,
    certificate: { id: String(certs[0].id), code, issuedAt: String(certs[0].issued_at) },
  });
});
