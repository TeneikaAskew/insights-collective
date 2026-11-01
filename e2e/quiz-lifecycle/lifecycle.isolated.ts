// ABOUTME: Learner quiz lifecycle against a local stack (start_quiz_attempt, score-quiz, finalize_quiz_submission):
// ABOUTME: ordinary flows, three uncertainty schedules and three fault controls, each proven by a read-only DB ledger.
//
// NOT RUN. No case in this file has been executed against any stack. Listing it (playwright --list) is not a pass.
//
// Labels, per case (kept apart in results and screenshots; a FAULT case is never a plain real run):
//   REAL-BACKEND                                        nothing is altered between the browser and the stack.
//   FAULT(progress-write-500-before-db)            F6  the first progress write is answered 500 by the test; it never
//                                                       reaches the database.
//   FAULT(start-committed-response-lost +           U1  the retake start is forwarded and commits; the browser gets a
//         reconcile-read-aborted-before-db)             network error instead of the response; the first
//                                                       reconciliation read is aborted before it reaches the database.
//   FAULT(score-committed-response-lost +           U2  score-quiz is forwarded and finalizes; the browser gets a network
//         readback-aborted-before-db)                   error; read-backs are aborted before the database until released.
//   FAULT(answer-write-held-before-forward)         U3  the first answer write is held in the browser, not forwarded,
//                                                       until released; then forwarded unchanged.
//   FAULT(answers-read-500-before-db)               R1  the saved-answer restore read is answered 500 by the test.
//                                                   R2  the review answer read is answered 500 by the test.
//   FAULT(start-held-before-forward)                R3  the first start is held in the browser, not forwarded, while the
//                                                       learner repeats actions and moves A -> B -> A.
// Every forwarded fault request goes through forwardApproved() (exact origin first, maxRedirects 0, 3xx refused).
// Run only through playwright.quiz-lifecycle.config.ts, after preflight.mjs and fixture.sh have passed.
import type { Page } from '@playwright/test';
import {
  test, expect, scenario, readLedger, expectFinalized, expectProgressRead, attemptHistory, interactionShot,
  sent, settledAll, type NetEvent,
} from './session.fixture';

const REAL = 'REAL-BACKEND';
const FAULT = (k: string) => `FAULT(${k})`;
const RESULT = 'quiz-player-review';
const ACTIVE = 'quiz-player-active';

async function open(page: Page, nn: string) {
  await page.goto(scenario(nn).url, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quiz-player-loading')).toHaveCount(0, { timeout: 30000 });
}
const radio = (page: Page, label: string) => page.getByRole('radio', { name: label, exact: true });
async function choose(page: Page, label: string) { await radio(page, label).click(); }
async function next(page: Page) { await page.getByRole('button', { name: /^next/i }).click(); }
async function submit(page: Page) { await page.getByRole('button', { name: /submit quiz/i }).click(); }
const retryButton = (page: Page) => page.getByRole('button', { name: 'Retry', exact: true });
const nav = (page: Page, title: string) => page.getByText(title, { exact: true }).filter({ visible: true }).first();

/** Answers Q1 then Q2 and submits; waits for the result. */
async function take(page: Page, q1: string, q2: string) {
  await choose(page, q1);
  await next(page);
  await choose(page, q2);
  await submit(page);
  await expect(page.getByTestId(RESULT)).toBeVisible({ timeout: 30000 });
}
async function retake(page: Page) {
  await page.getByRole('button', { name: /retake quiz/i }).click();
  await expect(page.getByTestId(ACTIVE)).toBeVisible({ timeout: 30000 });
}
/** The result is settled: answers loaded, no progress save pending. */
async function expectResultSettled(page: Page, points: string) {
  await expect(page.getByTestId(RESULT)).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(points)).toBeVisible();
  await expect(page.getByText('Loading your answers…')).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByText('Saving your course progress…')).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByText("Your quiz was submitted, but your course progress wasn't saved.")).toHaveCount(0);
}
/** PostgreSQL timestamptz text ("2026-11-01 16:20:01.123+00") to epoch ms. */
function pgTime(t: string): number {
  return Date.parse(t.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
}
/** The timer shows the time left from the SERVER's started_at, within `tol` seconds. */
async function expectTimerFromServer(page: Page, startedAt: string, limitMinutes: number, tol = 5) {
  const text = (await page.getByTestId('quiz-timer').innerText()).match(/(\d+):(\d\d)/);
  expect(text, 'timer text').not.toBeNull();
  const shown = Number(text![1]) * 60 + Number(text![2]);
  const expected = limitMinutes * 60 - (Date.now() - pgTime(startedAt)) / 1000;
  expect(Math.abs(shown - expected), `timer ${shown}s vs server-derived ${Math.round(expected)}s`).toBeLessThanOrEqual(tol);
}
const writesAfter = (net: NetEvent[], t: number) => net.filter((e) => e.kind === 'write' && e.phase === 'sent' && e.at >= t);

test.describe(REAL, () => {
  test('F1 limit 1: one start, one finalized attempt, progress read, result stays usable', async ({ learner: page, net, snapshot }) => {
    const s = scenario('10');
    await open(page, '10');
    await take(page, 'Four', 'Blue');
    await expectResultSettled(page, '2 / 2 points');
    await snapshot('F1-result', 'real', async () => {
      await expect(page.getByTestId(RESULT)).toBeVisible();
      await expect(page.getByText('2 / 2 points')).toBeVisible();
      await expect(page.getByText(/Attempt 1 of 1 · No attempts remaining/)).toBeVisible();
      await expect(page.getByRole('button', { name: /retake quiz/i })).toHaveCount(0);
      await expect(page.getByText(/^Correct · 1\/1$/)).toHaveCount(2);
    });
    await expectProgressRead(s, 'F1-progress');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectResultSettled(page, '2 / 2 points');
    expectFinalized(readLedger(s.quiz, 'F1'), s, [{ attempt: 1, q1: s.four, q2: s.blue }]);
    expect(sent(net, 'start')).toHaveLength(1);
    expect(sent(net, 'score')).toHaveLength(1);
  });

  test('F2 resume: same attempt, saved answer, timer from the unchanged server started_at', async ({ learner: page, net, snapshot }) => {
    const s = scenario('11');
    await open(page, '11');
    await choose(page, 'Four');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15000 });
    const before = readLedger(s.quiz, 'F2-before');
    expect(before.attempts.map((a) => [a.attempt, a.state, a.answers])).toEqual([[1, 'pending_review', 1]]);
    await expectTimerFromServer(page, before.attempts[0].startedAt, 30);
    await page.waitForTimeout(3000); // let the clock move so a reset timer would be visible
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(radio(page, 'Four')).toBeChecked({ timeout: 30000 });
    const after = readLedger(s.quiz, 'F2-after');
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0].id).toBe(before.attempts[0].id);
    expect(after.attempts[0].startedAt).toBe(before.attempts[0].startedAt);
    expect(after.answers.map((r) => [r.attempt, r.question, r.answer])).toEqual([[1, s.q1, s.four]]);
    await expectTimerFromServer(page, after.attempts[0].startedAt, 30);
    await snapshot('F2-resume', 'real', async () => {
      await expect(page.getByTestId(ACTIVE)).toBeVisible();
      await expect(page.getByTestId('quiz-timer')).toBeVisible();
      await expect(radio(page, 'Four')).toBeChecked();
      await expect(page.getByRole('button', { name: /^next/i })).toBeEnabled();
    });
    expect(sent(net, 'start')).toHaveLength(1);
    expect(readLedger(s.quiz, 'F2-progress').progress).toEqual([]);
  });

  test('F3 limit 2 retake: attempt 2 stays empty in DB and UI for >2s, attempt 1 history unchanged', async ({ learner: page, net }) => {
    const s = scenario('12');
    await open(page, '12');
    await take(page, 'Four', 'Red');
    await expectResultSettled(page, '1 / 2 points');
    await expect.poll(() => settledAll(net, 'write'), { timeout: 15000 }).toBe(true); // old autosave settled
    const first = readLedger(s.quiz, 'F3-after-1');
    expectFinalized(first, s, [{ attempt: 1, q1: s.four, q2: s.red }]);
    const retakeAt = Date.now();
    await retake(page); // immediately
    await expect(page.getByText(/Attempt 2 of 2/)).toBeVisible();
    await expect.poll(() => readLedger(s.quiz, 'F3-retake').attempts.length, { timeout: 15000 }).toBe(2);
    await page.waitForTimeout(2500); // longer than the 2 s autosave debounce
    const blank = readLedger(s.quiz, 'F3-blank');
    expect(blank.attempts[1]).toMatchObject({ attempt: 2, state: 'pending_review', answers: 0 });
    expect(blank.answers.filter((r) => r.attempt === 2)).toEqual([]);
    expect(writesAfter(net, retakeAt)).toHaveLength(0);
    await expect(radio(page, 'Four')).not.toBeChecked();
    await expect(radio(page, 'Three')).not.toBeChecked();
    expect(attemptHistory(blank, 1)).toEqual(attemptHistory(first, 1));
    await take(page, 'Three', 'Blue');
    await expectResultSettled(page, '1 / 2 points');
    await expect(page.getByText(/Attempt 2 of 2 · No attempts remaining/)).toBeVisible();
    const l = readLedger(s.quiz, 'F3');
    expectFinalized(l, s, [{ attempt: 1, q1: s.four, q2: s.red }, { attempt: 2, q1: s.three, q2: s.blue }]);
    expect(attemptHistory(l, 1)).toEqual(attemptHistory(first, 1));
    await expectProgressRead(s, 'F3-progress');
  });

  for (const [nn, label] of [['13', 'NULL'], ['14', '0']] as const) {
    test(`F4 allowed_attempts ${label} is unlimited`, async ({ learner: page }) => {
      const s = scenario(nn);
      await open(page, nn);
      for (let i = 1; i <= 3; i += 1) {
        await take(page, 'Four', 'Blue');
        await expectResultSettled(page, '2 / 2 points');
        await expect(page.getByText(new RegExp(`Attempt ${i} · Unlimited attempts`))).toBeVisible();
        if (i < 3) await retake(page);
      }
      await expect(page.getByRole('button', { name: /retake quiz/i })).toBeVisible();
      const all = [1, 2, 3].map((attempt) => ({ attempt, q1: s.four, q2: s.blue }));
      expectFinalized(readLedger(s.quiz, `F4-${label}`), s, all);
      await expectProgressRead(s, `F4-${label}-progress`);
    });
  }

  test('F5 A to B to A: no state or write crosses quizzes', async ({ learner: page }) => {
    const a = scenario('15');
    const b = scenario('16');
    await open(page, '15');
    await choose(page, 'Four');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15000 });
    await nav(page, 'QLC F5 quiz B').click();
    await expect(radio(page, 'Four')).not.toBeChecked({ timeout: 30000 });
    await choose(page, 'Three');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15000 });
    await nav(page, 'QLC F5 quiz A').click();
    await expect(radio(page, 'Four')).toBeChecked({ timeout: 30000 });
    const la = readLedger(a.quiz, 'F5-A');
    const lb = readLedger(b.quiz, 'F5-B');
    expect(la.attempts.map((x) => [x.attempt, x.state])).toEqual([[1, 'pending_review']]);
    expect(lb.attempts.map((x) => [x.attempt, x.state])).toEqual([[1, 'pending_review']]);
    expect(la.answers.map((r) => [r.question, r.answer])).toEqual([[a.q1, a.four]]);
    expect(lb.answers.map((r) => [r.question, r.answer])).toEqual([[b.q1, b.three]]);
    expect(la.progress).toEqual([]);
    expect(lb.progress).toEqual([]);
  });

  test.describe('viewport interaction 390x844', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('M1 full flow driven at 390x844: answer, resume, submit, result', async ({ learner: page }) => {
      const s = scenario('1f');
      await open(page, '1f');
      await expect(page.getByTestId(ACTIVE)).toBeVisible();
      await choose(page, 'Four');
      await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15000 });
      await interactionShot(page, 'M1-active');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(radio(page, 'Four')).toBeChecked({ timeout: 30000 });
      await expect(page.getByRole('button', { name: /^next/i })).toBeInViewport();
      await interactionShot(page, 'M1-resume');
      await next(page);
      await choose(page, 'Blue');
      await expect(page.getByRole('button', { name: /submit quiz/i })).toBeInViewport();
      await submit(page);
      await expectResultSettled(page, '2 / 2 points');
      await interactionShot(page, 'M1-result');
      expectFinalized(readLedger(s.quiz, 'M1'), s, [{ attempt: 1, q1: s.four, q2: s.blue }]);
      await expectProgressRead(s, 'M1-progress');
    });
  });
});

test.describe(FAULT('progress-write-500-before-db'), () => {
  test('F6 progress write fails once: result kept, only progress retried, scored once, progress read', async ({ learner: page, net, snapshot }) => {
    const s = scenario('17');
    let failNext = true;
    await page.route('**/rest/v1/content_item_progressions**', (route) => {
      if (route.request().method() !== 'GET' && failNext) {
        failNext = false;
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"injected progress failure"}' });
      }
      return route.fallback();
    });
    await open(page, '17');
    await take(page, 'Four', 'Blue');
    const banner = page.getByText("Your quiz was submitted, but your course progress wasn't saved.");
    await expect(banner).toBeVisible({ timeout: 30000 });
    await snapshot('F6-progress-failed', 'fault', async () => {
      await expect(banner).toBeVisible();
      await expect(page.getByText('2 / 2 points')).toBeVisible();
      await expect(page.getByRole('button', { name: /retry saving progress/i })).toBeEnabled();
    });
    expect(readLedger(s.quiz, 'F6-before-retry').progress).toEqual([]);
    expectFinalized(readLedger(s.quiz, 'F6-finalized'), s, [{ attempt: 1, q1: s.four, q2: s.blue }]);
    await page.getByRole('button', { name: /retry saving progress/i }).click();
    await expectProgressRead(s, 'F6-progress'); // poll the ledger to exactly 'read' ...
    await expectResultSettled(page, '2 / 2 points'); // ... and the UI to settled, not "error disappeared"
    expectFinalized(readLedger(s.quiz, 'F6'), s, [{ attempt: 1, q1: s.four, q2: s.blue }]);
    expect(sent(net, 'score')).toHaveLength(1);
    expect(sent(net, 'progress')).toHaveLength(2);
  });
});

test.describe(FAULT('start-committed-response-lost + reconcile-read-aborted-before-db'), () => {
  test('U1 uncertain retake: attempt 2 adopted blank, attempt 1 history unchanged', async ({ learner: page, net, snapshot, forwardApproved }) => {
    const s = scenario('18');
    await open(page, '18');
    await take(page, 'Four', 'Red');
    await expectResultSettled(page, '1 / 2 points');
    await expect.poll(() => settledAll(net, 'write'), { timeout: 15000 }).toBe(true);
    const first = readLedger(s.quiz, 'U1-after-1');
    expectFinalized(first, s, [{ attempt: 1, q1: s.four, q2: s.red }]);

    let loseStart = true;
    let loseLatest = true;
    await page.route('**/rest/v1/rpc/start_quiz_attempt**', async (route) => {
      if (!loseStart) return route.fallback();
      loseStart = false;
      const res = await forwardApproved(route); // commits on the server
      if (res) await route.abort('failed'); // the browser never sees the response
    });
    await page.route(`**/rest/v1/quiz_submissions?*quiz_id=eq.${s.quiz}*`, (route) => {
      if (route.request().method() !== 'GET' || !loseLatest) return route.fallback();
      loseLatest = false;
      return route.abort('failed'); // never reaches the database
    });
    await page.getByRole('button', { name: /retake quiz/i }).click();
    const uncertain = page.getByText("Couldn't confirm whether your attempt started");
    await expect(uncertain).toBeVisible({ timeout: 30000 });
    await snapshot('U1-start-uncertain', 'fault', async () => {
      await expect(uncertain).toBeVisible();
      await expect(retryButton(page)).toBeEnabled();
      await expect(page.getByRole('radio')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /submit quiz/i })).toHaveCount(0);
    });
    const during = readLedger(s.quiz, 'U1-during');
    expect(during.attempts.map((a) => [a.attempt, a.state, a.answers])).toEqual([[1, 'complete', 2], [2, 'pending_review', 0]]);
    expect(attemptHistory(during, 1)).toEqual(attemptHistory(first, 1));

    await retryButton(page).click();
    await expect(page.getByText(/Attempt 2 of 2/)).toBeVisible({ timeout: 30000 });
    await expect(radio(page, 'Four')).not.toBeChecked();
    await expect(radio(page, 'Three')).not.toBeChecked();
    await take(page, 'Three', 'Blue');
    await expectResultSettled(page, '1 / 2 points');

    const l = readLedger(s.quiz, 'U1');
    expectFinalized(l, s, [{ attempt: 1, q1: s.four, q2: s.red }, { attempt: 2, q1: s.three, q2: s.blue }]);
    expect(attemptHistory(l, 1)).toEqual(attemptHistory(first, 1));
    expect(sent(net, 'start')).toHaveLength(2); // attempt 1, then the one lost retake start; Retry only reconciles
    await expectProgressRead(s, 'U1-progress');
  });
});

test.describe(FAULT('score-committed-response-lost + readback-aborted-before-db'), () => {
  test('U2 score commits, response and read-back lost: blocked until a read confirms, scored once, progress read', async ({ learner: page, net, snapshot, forwardApproved }) => {
    const s = scenario('19');
    await open(page, '19');
    await choose(page, 'Four');
    await next(page);
    await choose(page, 'Blue');
    let loseScore = true;
    let loseReadback = true;
    await page.route('**/functions/v1/score-quiz**', async (route) => {
      if (route.request().method() !== 'POST' || !loseScore) return route.fallback();
      loseScore = false;
      const res = await forwardApproved(route); // finalizes on the server
      if (res) await route.abort('failed');
    });
    await page.route('**/rest/v1/quiz_submissions?*id=eq.*', (route) => {
      const u = route.request().url();
      if (route.request().method() !== 'GET' || !loseReadback || u.includes('quiz_id=')) return route.fallback();
      return route.abort('failed'); // never reaches the database
    });
    await submit(page);
    const uncertain = page.getByText("Couldn't confirm whether your quiz was submitted");
    await expect(uncertain).toBeVisible({ timeout: 30000 });
    await snapshot('U2-submit-uncertain', 'fault', async () => {
      await expect(uncertain).toBeVisible();
      await expect(retryButton(page)).toBeEnabled();
      await expect(page.getByRole('button', { name: /submit quiz/i })).toHaveCount(0);
      await expect(page.getByRole('radio')).toHaveCount(0);
    });

    const blockedAt = Date.now();
    const during = readLedger(s.quiz, 'U2-during');
    expectFinalized(during, s, [{ attempt: 1, q1: s.four, q2: s.blue }]); // the server did finalize
    expect(during.progress).toEqual([]);
    await page.waitForTimeout(3000); // longer than the 2 s autosave debounce
    const later = readLedger(s.quiz, 'U2-during-later');
    expect(later.raw).toEqual(during.raw);
    expect(writesAfter(net, blockedAt)).toHaveLength(0);
    expect(sent(net, 'progress')).toHaveLength(0);

    loseReadback = false;
    await retryButton(page).click();
    await expectProgressRead(s, 'U2-progress');
    await expectResultSettled(page, '2 / 2 points');
    expectFinalized(readLedger(s.quiz, 'U2'), s, [{ attempt: 1, q1: s.four, q2: s.blue }]);
    expect(sent(net, 'score')).toHaveLength(1);
    expect(sent(net, 'start')).toHaveLength(1);
  });
});

test.describe(FAULT('answer-write-held-before-forward'), () => {
  test('U3 leave mid-save and return: the held write settles 2xx before score-quiz, no late write after', async ({ learner: page, net }) => {
    const s = scenario('1a');
    let release!: () => void;
    const released = new Promise<void>((r) => { release = r; });
    let heldUrl = '';
    await page.route('**/rest/v1/quiz_submission_answers**', async (route) => {
      if (route.request().method() !== 'POST' || heldUrl) return route.fallback();
      heldUrl = route.request().url();
      await released; // held in the browser; nothing has been forwarded yet
      return route.fallback();
    });
    await open(page, '1a');
    await choose(page, 'Four');
    await expect.poll(() => heldUrl, { timeout: 15000 }).not.toBe('');
    expect(readLedger(s.quiz, 'U3-held').answers).toEqual([]); // held before forward: not in the DB
    await nav(page, 'QLC F1 limit one').click(); // leave
    await nav(page, 'QLC U3 remount write').click(); // return
    release();
    await expect.poll(() => net.some((e) => e.kind === 'write' && e.phase === 'done' && (e.status ?? 0) >= 200 && (e.status ?? 0) < 300), { timeout: 15000 }).toBe(true);
    await expect(radio(page, 'Four')).toBeChecked({ timeout: 30000 });
    await next(page);
    await choose(page, 'Blue');
    await submit(page);
    await expectResultSettled(page, '2 / 2 points');

    const scoreSent = net.find((e) => e.kind === 'score' && e.phase === 'sent')!;
    expect(scoreSent).toBeTruthy();
    const writes = net.filter((e) => e.kind === 'write');
    const firstDone = writes.find((e) => e.phase === 'done');
    expect(firstDone?.status, 'held write settled successfully').toBeGreaterThanOrEqual(200);
    expect(firstDone!.status!).toBeLessThan(300);
    expect(firstDone!.at).toBeLessThanOrEqual(scoreSent.at);
    expect(writes.every((e) => e.phase === 'sent' || e.at <= scoreSent.at)).toBe(true); // all settled before score
    const atResult = readLedger(s.quiz, 'U3-result');
    expectFinalized(atResult, s, [{ attempt: 1, q1: s.four, q2: s.blue }]);
    await page.waitForTimeout(3000); // longer than the 2 s autosave debounce
    expect(writesAfter(net, scoreSent.at)).toHaveLength(0);
    expect(readLedger(s.quiz, 'U3-later').raw).toEqual(atResult.raw);
    await expectProgressRead(s, 'U3-progress');
  });
});

test.describe(FAULT('answers-read-500-before-db'), () => {
  test('R1 saved-answer restore fails: blocks honestly, no new start, Retry restores the same attempt', async ({ learner: page, net, snapshot }) => {
    const s = scenario('1b');
    await open(page, '1b');
    await choose(page, 'Four');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15000 });
    const before = readLedger(s.quiz, 'R1-before');
    expect(before.attempts.map((a) => [a.attempt, a.state, a.answers])).toEqual([[1, 'pending_review', 1]]);
    let fail = true;
    await page.route('**/rest/v1/quiz_submission_answers?**', (route) => {
      if (route.request().method() !== 'GET' || !fail) return route.fallback();
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"injected restore failure"}' });
    });
    const reloadAt = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    const blocked = page.getByText("Couldn't restore your saved answers");
    await expect(blocked).toBeVisible({ timeout: 30000 });
    await snapshot('R1-restore-failed', 'fault', async () => {
      await expect(blocked).toBeVisible();
      await expect(retryButton(page)).toBeEnabled();
      await expect(page.getByRole('radio')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /submit quiz/i })).toHaveCount(0);
    });
    expect(net.filter((e) => e.kind === 'start' && e.at >= reloadAt)).toHaveLength(0);
    expect(writesAfter(net, reloadAt)).toHaveLength(0);
    expect(readLedger(s.quiz, 'R1-blocked').raw).toEqual(before.raw);
    fail = false;
    await retryButton(page).click();
    await expect(radio(page, 'Four')).toBeChecked({ timeout: 30000 });
    expect(readLedger(s.quiz, 'R1-restored').attempts.map((a) => a.id)).toEqual([before.attempts[0].id]);
    await next(page);
    await choose(page, 'Blue');
    await submit(page);
    await expectResultSettled(page, '2 / 2 points');
    expectFinalized(readLedger(s.quiz, 'R1'), s, [{ attempt: 1, q1: s.four, q2: s.blue }]);
    expect(sent(net, 'start')).toHaveLength(1);
    await expectProgressRead(s, 'R1-progress');
  });

  test('R2 review answer read fails: no false Incorrect or zero, Retry shows the graded review', async ({ learner: page, snapshot }) => {
    const s = scenario('1c');
    let fail = true;
    await page.route('**/rest/v1/quiz_submission_answers?**', (route) => {
      if (route.request().method() !== 'GET' || !fail) return route.fallback();
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"injected review failure"}' });
    });
    await open(page, '1c');
    await take(page, 'Four', 'Blue');
    const failed = page.getByText("Couldn't load your answer review");
    await expect(failed).toBeVisible({ timeout: 30000 });
    const noFalseGrade = async () => {
      await expect(failed).toBeVisible();
      await expect(page.getByText('2 / 2 points')).toBeVisible();
      await expect(page.getByText(/Incorrect/)).toHaveCount(0);
      await expect(page.getByText(/· 0\/1/)).toHaveCount(0);
      await expect(retryButton(page)).toBeEnabled();
    };
    await snapshot('R2-review-failed', 'fault', noFalseGrade);
    expectFinalized(readLedger(s.quiz, 'R2-finalized'), s, [{ attempt: 1, q1: s.four, q2: s.blue }]);
    fail = false;
    await retryButton(page).click();
    await expect(page.getByText(/^Correct · 1\/1$/)).toHaveCount(2, { timeout: 30000 });
    await expect(page.getByText(/Incorrect/)).toHaveCount(0);
    await expectProgressRead(s, 'R2-progress');
    await expectResultSettled(page, '2 / 2 points');
  });
});

test.describe(FAULT('start-held-before-forward'), () => {
  test('R3 slow start, repeated actions, A to B to A: one start, attributed to A only', async ({ learner: page, net }) => {
    const a = scenario('1d');
    const b = scenario('1e');
    let release!: () => void;
    const released = new Promise<void>((r) => { release = r; });
    let held = false;
    await page.route('**/rest/v1/rpc/start_quiz_attempt**', async (route) => {
      if (held) return route.fallback();
      held = true;
      await released; // held in the browser; not forwarded yet
      return route.fallback();
    });
    await open(page, '1d');
    await choose(page, 'Four');
    await expect.poll(() => held, { timeout: 15000 }).toBe(true);
    for (const label of ['Three', 'Four', 'Three', 'Four']) await radio(page, label).click({ timeout: 2000 }).catch(() => undefined); // repeated
    expect(readLedger(a.quiz, 'R3-A-held').attempts).toEqual([]); // held before forward: nothing committed
    await nav(page, 'QLC R3 slow start B').click();
    await expect(page.getByTestId('quiz-player-loading')).toHaveCount(0, { timeout: 30000 });
    release();
    await expect.poll(() => settledAll(net, 'start'), { timeout: 15000 }).toBe(true);
    await expect(radio(page, 'Four')).not.toBeChecked();
    await nav(page, 'QLC R3 slow start A').click();
    await expect(page.getByTestId('quiz-player-loading')).toHaveCount(0, { timeout: 30000 });
    await page.waitForTimeout(2500); // any debounced write has fired
    await expect.poll(() => settledAll(net, 'write'), { timeout: 15000 }).toBe(true);

    const la = readLedger(a.quiz, 'R3-A');
    const lb = readLedger(b.quiz, 'R3-B');
    expect(sent(net, 'start')).toHaveLength(1);
    expect(la.attempts.map((x) => [x.attempt, x.state])).toEqual([[1, 'pending_review']]);
    expect(lb.attempts).toEqual([]);
    expect(lb.answers).toEqual([]);
    expect(la.answers.every((r) => r.attempt === 1 && [a.q1, a.q2].includes(r.question))).toBe(true);
    // The screen agrees with the ledger: a saved Q1 answer is shown, an unsaved one is not invented.
    const q1 = la.answers.find((r) => r.question === a.q1)?.answer;
    if (q1 === a.four) await expect(radio(page, 'Four')).toBeChecked();
    else if (q1 === a.three) await expect(radio(page, 'Three')).toBeChecked();
    else { await expect(radio(page, 'Four')).not.toBeChecked(); await expect(radio(page, 'Three')).not.toBeChecked(); }
    expect(la.progress).toEqual([]);
    expect(lb.progress).toEqual([]);
  });
});

