// ABOUTME: Journey J4 (UNRUN): after grading, the learner reloads and reads back the grade, the exact feedback TEXT (no markup),
// ABOUTME: their own file through Storage, 100% progress, and the certificate (unchanged by grading) with its verification route.
//
// J4a is EXPECTED TO FAIL on the current #139 source: InlineAssignmentSubmit renders grader_comments as React text, and
// SpeedGrader stores HTML (<p>...</p>), so the learner would see the literal tags. The local unit characterization
// (journey/feedback-render.test.tsx) shows this at the mocked tier. No product change is made here (product source
// belongs to the PR 134 thread); the assertion stays strict so the defect cannot pass silently.
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, GRADE, POINTS, FEEDBACK, UPLOAD, PUBLISHED_ITEMS, route } from './ids';
import { sha256, shot } from './observe';

test.describe.configure({ mode: 'serial' });

test(`J4a lesson route, two fresh loads: Graded, Score ${GRADE} / ${POINTS}, feedback shown as text with no markup`, async ({ page }, info) => {
  for (let i = 0; i < 2; i++) {
    await page.goto(route.lesson(J.item.assignment));
    await waitForPageLoad(page);
    const status = page.getByText(/Score \d+ \/ \d+/).filter({ visible: true });
    await expect(status).toHaveCount(1);
    await expect(status).toContainText(`Graded · Attempt 1 · Score ${GRADE} / ${POINTS}`);
    await expect(page.getByText(FEEDBACK, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('<p>', { exact: false }).filter({ visible: true })).toHaveCount(0);
  }
  await shot(page, info, 'J4a-lesson-graded');
});

test('J4b the learner opens their own submitted file; the bytes equal the upload (no URL is recorded)', async ({ page }) => {
  await page.goto(route.lesson(J.item.assignment));
  await waitForPageLoad(page);
  const popupP = page.waitForEvent('popup', { timeout: 30_000 });
  await page.getByRole('button', { name: UPLOAD.name }).first().click();
  const popup = await popupP;
  const resp = await popup.waitForResponse(() => true, { timeout: 30_000 }).catch(() => null);
  expect(resp, 'the signed object response arrived').not.toBeNull();
  expect(resp!.status()).toBe(200);
  expect(sha256(await resp!.body())).toBe(sha256(UPLOAD.body()));
  await popup.close();
});

test(`J4c grades and progress routes agree: ${GRADE} / ${POINTS}, ${PUBLISHED_ITEMS} of ${PUBLISHED_ITEMS} items, 100%`, async ({ page }, info) => {
  await page.goto(route.grades);
  await waitForPageLoad(page);
  const list = page.getByTestId('course-grades-list').filter({ visible: true });
  const row = list.locator(':scope > div').filter({ hasText: J.title.assignment });
  await expect(row).toHaveCount(1);
  await expect(row.locator('span.tabular-nums')).toHaveText(new RegExp(`^\\s*${GRADE}\\s*/\\s*${POINTS}\\s*$`));
  await shot(page, info, 'J4c-grades');

  await page.goto(route.progress);
  await waitForPageLoad(page);
  await expect(page.getByText('100%').filter({ visible: true }).first()).toBeVisible();
  await shot(page, info, 'J4c-progress');
});

test('J4d certificate: ready, one certificate card, PDF download names the shown code, and the verify route accepts it', async ({ page }, info) => {
  await page.goto(route.certificate);
  await waitForPageLoad(page);
  await expect(page.getByRole('heading', { name: 'Your certificate is ready' })).toBeVisible();
  await expect(page.getByText('Certificate already issued!')).toBeVisible();
  const code = (await page.locator('text=/^[0-9A-F]{12}$/').filter({ visible: true }).first().innerText()).trim();
  expect(code).toMatch(/^[0-9A-F]{12}$/);
  const dlP = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: /Download/ }).first().click();
  expect((await dlP).suggestedFilename()).toBe(`certificate-${code}.pdf`);
  await shot(page, info, 'J4d-certificate');

  // As the certificate's own learner (the RLS-visible case). A third-party verifier is NOT covered: the snapshot's
  // certificates SELECT policies allow only the owner and course staff, so anonymous verification is an open question.
  await page.goto(`/verify-certificate/${code}`);
  await waitForPageLoad(page);
  await expect(page.getByText('Invalid verification code')).toHaveCount(0);
  await expect(page.getByText(J.title.course).filter({ visible: true }).first()).toBeVisible();
});
