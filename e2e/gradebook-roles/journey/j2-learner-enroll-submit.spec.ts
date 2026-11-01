// ABOUTME: Journey J2 (UNRUN): the learner finds the now-published course in the catalog, enrolls with the UI control,
// ABOUTME: reads the page lesson, sees the certificate still locked, then uploads a real file and submits the assignment.
//
// Every write is the app's own request under the learner's session: enrollment INSERT, progression upsert, Storage
// object upload into submissions/<course>/<learner>/ (course_submission_insert policy), submission INSERT, attachment
// INSERT (submission_attachments policy) and the assignment progression upsert (enforce_assessed_progression trigger).
//
// Existing eligibility, observed in source and NOT changed: the certificate is auto-issued by
// auto_issue_certificate_on_progression when the last published item is done with final evidence; a 'submitted'
// submission with submitted_at counts (is_final_assignment_submission). No grade or pass threshold exists, so the
// certificate is EXPECTED to appear right after submission, before any grade. J2c asserts exactly that; the
// witness proves issued_at < graded_at. Whether a grade should gate the certificate is an owner policy decision.
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, UPLOAD, SUBMISSION_PREFIX, route } from './ids';
import { uiWrite, oneRow, appCall, countCalls, shot } from './observe';

test.describe.configure({ mode: 'serial' });

test('J2a catalog -> detail -> Enroll: one enrollment row for this learner and course; reload shows Continue learning', async ({ page }, info) => {
  await page.goto(route.catalog);
  await waitForPageLoad(page);
  const card = page.getByText(J.title.course, { exact: true }).filter({ visible: true });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/courses/${J.course}$`));
  await waitForPageLoad(page);

  const res = await uiWrite(page, () => page.getByRole('button', { name: /Enroll for free/ }).click(), 'POST', '/rest/v1/enrollments');
  const sent = res.request().postDataJSON();
  expect(sent.user_id).toBe(J.memberId);
  expect(sent.course_id).toBe(J.course);
  expect(res.status(), 'enrollment insert').toBe(201);
  await expect(page.getByText('Successfully enrolled!').first()).toBeVisible();

  await page.goto(route.detail);
  await waitForPageLoad(page);
  await expect(page.getByRole('link', { name: 'Continue learning' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Enroll for free/ })).toHaveCount(0);
  await shot(page, info, 'J2a-enrolled-after-reload');
});

test('J2b page lesson: reading to the end writes one read progression; certificate stays locked at 1 of 2', async ({ page }, info) => {
  // The listener is armed BEFORE navigation: on a short page the scroll sentinel is visible at once and fires ~1.5 s later.
  const res = await uiWrite(page, async () => {
    await page.goto(route.lesson(J.item.page));
    await waitForPageLoad(page);
    await expect(page.getByText(J.title.page).filter({ visible: true }).first()).toBeVisible();
    await page.mouse.wheel(0, 20_000);
  }, 'POST', '/rest/v1/content_item_progressions');
  const sent = res.request().postDataJSON();
  expect(sent.content_item_id).toBe(J.item.page);
  expect(sent.user_id).toBe(J.memberId);
  expect(sent.workflow_state).toBe('read');
  expect(res.status(), 'progression upsert').toBeLessThan(300);

  await page.goto(route.certificate);
  await waitForPageLoad(page);
  await expect(page.getByRole('heading', { name: 'Course certificate' })).toBeVisible();
  await expect(page.getByText('You must complete all course requirements before you can receive a certificate.')).toBeVisible();
  await shot(page, info, 'J2b-certificate-locked-after-page');
});

test('J2c assignment: real file upload to the learner submissions prefix, one submitted row, one attachment row; certificate then issued by the existing rule', async ({ page }, info) => {
  // Opening and scrolling the assessed item must not complete it: no progression write without a submission.
  const early = await countCalls(page, appCall('POST', '/rest/v1/content_item_progressions'), async () => {
    await page.goto(route.lesson(J.item.assignment));
    await waitForPageLoad(page);
    await expect(page.getByText(J.title.assignment).filter({ visible: true }).first()).toBeVisible();
    await page.mouse.wheel(0, 20_000);
    await page.waitForTimeout(2_500);
  });
  expect(early, 'no progression write from viewing an assignment').toBe(0);

  await page.locator('input[type="file"]').first().setInputFiles({ name: UPLOAD.name, mimeType: UPLOAD.mimeType, buffer: UPLOAD.body() });

  const uploadP = page.waitForResponse((r) => r.request().method() === 'POST'
    && r.url().includes(`/storage/v1/object/course-documents/${SUBMISSION_PREFIX}`), { timeout: 30_000 });
  const subP = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/rest/v1/assignment_submissions'), { timeout: 30_000 });
  const attP = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/rest/v1/submission_attachments'), { timeout: 30_000 });
  const progP = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/rest/v1/content_item_progressions'), { timeout: 30_000 });
  await page.getByRole('button', { name: /Submit/ }).click();

  const up = await uploadP;
  expect(up.status(), 'storage upload under the learner prefix').toBe(200);

  const sub = await subP;
  const sentSub = sub.request().postDataJSON();
  expect(sentSub.assignment_id).toBe(J.assignment);
  expect(sentSub.user_id).toBe(J.memberId);
  expect(sentSub.workflow_state).toBe('submitted');
  expect(sentSub.attempt).toBe(1);
  expect(sentSub.submission_type).toBe('online_upload');
  const subRow = await oneRow(sub, 'submission insert');
  expect(subRow.workflow_state).toBe('submitted');
  expect(subRow.grade ?? null).toBeNull();

  const att = await attP;
  const attRows = await att.json();
  expect(attRows).toHaveLength(1);
  expect(attRows[0].filename).toBe(UPLOAD.name);
  expect(String(attRows[0].url).startsWith(SUBMISSION_PREFIX), 'attachment row stores the object key, not a URL').toBe(true);
  expect(attRows[0].size).toBe(UPLOAD.body().length);

  const prog = await progP;
  expect(prog.request().postDataJSON().content_item_id).toBe(J.item.assignment);
  expect(prog.status(), 'assignment progression accepted by enforce_assessed_progression').toBeLessThan(300);
  await expect(page.getByText('Assignment submitted').first()).toBeVisible();

  // Fresh load: state comes from the database, not component state.
  await page.goto(route.lesson(J.item.assignment));
  await waitForPageLoad(page);
  await expect(page.getByText(/Submitted · Attempt 1/).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText(UPLOAD.name).filter({ visible: true }).first()).toBeVisible();
  await shot(page, info, 'J2c-submitted-after-reload');

  // Existing eligibility: both published items are done with final evidence, so the trigger has issued the certificate.
  await page.goto(route.certificate);
  await waitForPageLoad(page);
  await expect(page.getByRole('heading', { name: 'Your certificate is ready' })).toBeVisible();
  await shot(page, info, 'J2c-certificate-issued-before-grade');
});
