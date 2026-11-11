// ABOUTME: Journey J4 (UNRUN): after grading, the learner reloads and reads back the grade, the feedback text, their own file,
// ABOUTME: scoped progress and the certificate (same id, code and issued_at as before grading). Each check is independent.
//
// Not serial: J4a is EXPECTED RED on the #139 source (F1: SpeedGrader stores HTML, the learner view renders it as text, so
// the literal <p> shows; the mocked characterization is journey/feedback-render.test.tsx). Its failure must not skip the
// read-only checks J4b..J4d. No fix approach is assumed here; the product fix is a separate scope (PR 134 thread).
//
// DEFERRED, not covered: public certificate verification. /verify-certificate/:code is VerifyCertificate.tsx (lines 40-53),
// which calls the public verify-certificate Edge function; that function uses the service role to call verify_certificate
// and rate_limit_certificate_verify (the latter inserts certificate_verification_attempts and prunes rows older than 24 h).
// This journey runs with NO Edge runtime, so the segment is out of scope: no stub, no backend change, no navigation. A
// future separate Edge scope would assert "Verified certificate" plus the exact code and course title.
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, GRADE, POINTS, FEEDBACK, UPLOAD, PROGRESS, route } from './ids';
import { BINDING } from '../fixture';
import { expectCalls, loadRunState, rowsOf, sha256, shot } from './observe';
import { expectProgress } from './progress-oracle';

test(`J4a lesson route, two fresh loads: Graded, Score ${GRADE} / ${POINTS}, feedback shown as exact text (EXPECTED RED, F1)`, async ({ page }, info) => {
  for (let i = 0; i < 2; i++) {
    await page.goto(route.lesson(J.item.assignment));
    await waitForPageLoad(page);
    const status = page.getByText(/Score \d+ \/ \d+/).filter({ visible: true });
    await expect(status).toHaveCount(1);
    await expect(status).toContainText(`Graded · Attempt 1 · Score ${GRADE} / ${POINTS}`);
    await expect(page.getByText(FEEDBACK, { exact: true }).filter({ visible: true })).toHaveCount(1);
  }
  await shot(page, info, 'J4a-lesson-graded');
});

test('J4b the learner opens their own file: the exact signed-object GET is armed before the click and returns the upload bytes', async ({ page, context }) => {
  const s = loadRunState();
  await page.goto(route.lesson(J.item.assignment));
  await waitForPageLoad(page);
  const objectPath = `/storage/v1/object/sign/course-documents/${s.attachmentKey}`;
  // Armed on the CONTEXT (the file opens in a new tab) before the click; the URL itself is never logged or attached.
  const respP = context.waitForEvent('response', {
    predicate: (r) => { try { const u = new URL(r.url()); return u.origin === BINDING.api.origin && r.request().method() === 'GET' && decodeURIComponent(u.pathname) === objectPath; } catch { return false; } },
    timeout: 30_000,
  });
  await expectCalls(page, { method: 'POST', path: objectPath }, () => page.getByRole('button', { name: UPLOAD.name }).first().click(), { count: 1, status: [200] });
  const resp = await respP;
  expect(resp.status()).toBe(200);
  expect(sha256(await resp.body())).toBe(sha256(UPLOAD.body()));
  for (const p of context.pages()) if (p !== page) await p.close();
});

test(`J4c grades and progress: ${GRADE} / ${POINTS}; 100% with 1 of 1 lessons and 1 of 1 assignments; average grade ${PROGRESS.averageGrade}`, async ({ page }, info) => {
  await page.goto(route.grades);
  await waitForPageLoad(page);
  const list = page.getByTestId('course-grades-list').filter({ visible: true });
  const row = list.locator(':scope > div').filter({ hasText: J.title.assignment });
  await expect(row).toHaveCount(1);
  await expect(row.locator('span.tabular-nums')).toHaveText(new RegExp(`^\\s*${GRADE}\\s*/\\s*${POINTS}\\s*$`));
  await shot(page, info, 'J4c-grades');

  // Completion (2 published items: page + assignment) and the grade metric are checked separately.
  await expectProgress(page, PROGRESS.afterSubmit, PROGRESS.averageGrade);
  await shot(page, info, 'J4c-progress');
});

test('J4d certificate after grading: the app SELECT returns the SAME id, code and issued_at recorded before grading; PDF names the code', async ({ page }, info) => {
  const s = loadRunState();
  const [read] = await expectCalls(page, { method: 'GET', path: '/rest/v1/certificates', query: { user_id: `eq.${J.memberId}`, course_id: `eq.${J.course}` } },
    async () => { await page.goto(route.certificate); await waitForPageLoad(page); }, { count: 1, status: [200] });
  const certs = await rowsOf(read);
  expect(certs).toHaveLength(1);
  expect(certs[0].id).toBe(s.certificate.id);
  expect(certs[0].verification_code).toBe(s.certificate.code);
  expect(certs[0].issued_at, 'grading did not reissue the certificate').toBe(s.certificate.issuedAt);
  await expect(page.getByText(s.certificate.code, { exact: true }).filter({ visible: true })).toHaveCount(1);
  const dlP = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: /Download/ }).first().click();
  expect((await dlP).suggestedFilename()).toBe(`certificate-${s.certificate.code}.pdf`);
  await shot(page, info, 'J4d-certificate');
});
