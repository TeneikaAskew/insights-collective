// ABOUTME: Learner quiz lifecycle against the REAL local stack (start_quiz_attempt, score-quiz, finalize_quiz_submission):
// ABOUTME: fixtures F1-F6 and the three uncertainty schedules U1-U3, each proven by a read-only DB ledger, not the screen.
//
// Labels (kept apart in results and screenshots):
//   REAL-BACKEND                    nothing is altered between the browser and the stack.
//   REAL-BACKEND + FAULT(<kind>)    the server really runs and commits; only what the BROWSER receives is changed
//                                   (route.fetch() then abort, a fulfilled 500, or a held continue). Never a plain real run.
// Run only through playwright.quiz-lifecycle.config.ts, after preflight.mjs and fixture.sh have passed.
import type { Page } from '@playwright/test';
import { test, expect, scenario, readLedger } from './session.fixture';

const REAL = 'REAL-BACKEND';
const FAULT = (k: string) => `REAL-BACKEND + FAULT(${k})`;

async function open(page: Page, nn: string) {
  await page.goto(scenario(nn).url, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quiz-player-loading')).toHaveCount(0, { timeout: 30000 });
}
async function choose(page: Page, label: string) {
  await page.getByRole('radio', { name: label, exact: true }).click();
}
async function next(page: Page) { await page.getByRole('button', { name: /^next/i }).click(); }
async function back(page: Page) { await page.getByRole('button', { name: /^back/i }).click(); }
async function submit(page: Page) { await page.getByRole('button', { name: /submit quiz/i }).click(); }
/** Answers Q1 then Q2 and submits; waits for the result. */
async function take(page: Page, q1: string, q2: string) {
  await choose(page, q1);
  await next(page);
  await choose(page, q2);
  await submit(page);
  await expect(page.getByTestId('quiz-player-review')).toBeVisible({ timeout: 30000 });
}
async function retake(page: Page) {
  await page.getByRole('button', { name: /retake quiz/i }).click();
  await expect(page.getByTestId('quiz-player-active')).toBeVisible({ timeout: 30000 });
}
const answerOf = (l: ReturnType<typeof readLedger>, attempt: number, question: string) =>
  l.answers.find((a) => a.attempt === attempt && a.question === question)?.answer;

test.describe(REAL, () => {
  test('F1 limit 1: one start, one attempt, result stays usable', async ({ learner: page, net, shoot }) => {
    const s = scenario('10');
    await open(page, '10');
    await take(page, 'Four', 'Blue');
    await expect(page.getByText('2 / 2 points')).toBeVisible();
    await expect(page.getByText(/Attempt 1 of 1 · No attempts remaining/)).toBeVisible();
    await expect(page.getByRole('button', { name: /retake quiz/i })).toHaveCount(0);
    await shoot('F1-result', 'real');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('2 / 2 points')).toBeVisible({ timeout: 30000 });
    const l = readLedger(s.quiz, 'F1');
    expect(l.attempts).toHaveLength(1);
    expect(l.attempts[0]).toMatchObject({ attempt: 1, state: 'complete', score: '2' });
    expect(l.attempts[0].finishedAt).not.toBe('');
    expect(net.filter((e) => e.kind === 'start' && e.phase === 'sent')).toHaveLength(1);
    expect(net.filter((e) => e.kind === 'score' && e.phase === 'sent')).toHaveLength(1);
  });

  test('F2 resume: same attempt, saved answer, server clock', async ({ learner: page, net }) => {
    const s = scenario('11');
    await open(page, '11');
    await choose(page, 'Four');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15000 });
    const before = readLedger(s.quiz, 'F2-before');
    expect(before.attempts).toHaveLength(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('radio', { name: 'Four', exact: true })).toBeChecked({ timeout: 30000 });
    await expect(page.getByTestId('quiz-timer')).toBeVisible();
    const after = readLedger(s.quiz, 'F2-after');
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0].id).toBe(before.attempts[0].id);
    expect(after.attempts[0].startedAt).toBe(before.attempts[0].startedAt);
    expect(answerOf(after, 1, s.q1)).toBe(s.four);
    expect(net.filter((e) => e.kind === 'start' && e.phase === 'sent')).toHaveLength(1);
  });

  test('F3 limit 2 retake: attempt 2 is blank and history is kept', async ({ learner: page, shoot }) => {
    const s = scenario('12');
    await open(page, '12');
    await take(page, 'Four', 'Red');
    const first = readLedger(s.quiz, 'F3-after-1');
    await retake(page);
    await expect(page.getByText(/Attempt 2 of 2/)).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Four', exact: true })).not.toBeChecked();
    await expect(page.getByRole('radio', { name: 'Three', exact: true })).not.toBeChecked();
    await take(page, 'Three', 'Blue');
    await expect(page.getByText(/Attempt 2 of 2 · No attempts remaining/)).toBeVisible();
    await shoot('F3-result', 'real');
    const l = readLedger(s.quiz, 'F3');
    expect(l.attempts.map((a) => [a.attempt, a.state, a.score])).toEqual([[1, 'complete', '1'], [2, 'complete', '1']]);
    expect(l.attempts[0]).toEqual(first.attempts[0]);
    expect([answerOf(l, 1, s.q1), answerOf(l, 1, s.q2)]).toEqual([s.four, s.red]);
    expect([answerOf(l, 2, s.q1), answerOf(l, 2, s.q2)]).toEqual([s.three, s.blue]);
  });

  for (const [nn, label] of [['13', 'NULL'], ['14', '0']] as const) {
    test(`F4 allowed_attempts ${label} is unlimited`, async ({ learner: page }) => {
      const s = scenario(nn);
      await open(page, nn);
      for (let i = 1; i <= 3; i += 1) {
        await take(page, 'Four', 'Blue');
        await expect(page.getByText(new RegExp(`Attempt ${i} · Unlimited attempts`))).toBeVisible();
        if (i < 3) await retake(page);
      }
      await expect(page.getByRole('button', { name: /retake quiz/i })).toBeVisible();
      const l = readLedger(s.quiz, `F4-${label}`);
      expect(l.attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
      expect(l.attempts.every((a) => a.state === 'complete')).toBe(true);
    });
  }

  test('F5 A to B to A: no state or write crosses quizzes', async ({ learner: page }) => {
    const a = scenario('15');
    const b = scenario('16');
    await open(page, '15');
    await choose(page, 'Four');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByText('QLC F5 quiz B', { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole('radio', { name: 'Four', exact: true })).not.toBeChecked({ timeout: 30000 });
    await choose(page, 'Three');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByText('QLC F5 quiz A', { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole('radio', { name: 'Four', exact: true })).toBeChecked({ timeout: 30000 });
    const la = readLedger(a.quiz, 'F5-A');
    const lb = readLedger(b.quiz, 'F5-B');
    expect(la.attempts).toHaveLength(1);
    expect(lb.attempts).toHaveLength(1);
    expect(la.answers.map((r) => [r.question, r.answer])).toEqual([[a.q1, a.four]]);
    expect(lb.answers.map((r) => [r.question, r.answer])).toEqual([[b.q1, b.three]]);
  });
});

test.describe(FAULT('progress'), () => {
  test('F6 progress write fails once: result kept, only progress retried, scored once', async ({ learner: page, net, shoot }) => {
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
    await expect(page.getByText("Your quiz was submitted, but your course progress wasn't saved.")).toBeVisible({ timeout: 30000 });
    await shoot('F6-progress-failed', 'fault');
    expect(readLedger(s.quiz, 'F6-before-retry').progress).toEqual([]);
    await page.getByRole('button', { name: /retry saving progress/i }).click();
    await expect(page.getByText("Your quiz was submitted, but your course progress wasn't saved.")).toHaveCount(0, { timeout: 30000 });
    const l = readLedger(s.quiz, 'F6');
    expect(l.attempts).toHaveLength(1);
    expect(l.attempts[0]).toMatchObject({ state: 'complete', score: '2' });
    expect(l.progress).toHaveLength(1);
    expect(net.filter((e) => e.kind === 'score' && e.phase === 'sent')).toHaveLength(1);
  });
});

test.describe(FAULT('transport'), () => {
  test('U1 uncertain retake: attempt 2 adopted blank, only its own answers', async ({ learner: page, net, shoot }) => {
    const s = scenario('18');
    await open(page, '18');
    await take(page, 'Four', 'Red');
    const first = readLedger(s.quiz, 'U1-after-1');

    // The retake start commits on the server; the browser never sees the response. The first reconciliation read
    // (latest attempt for this quiz) is also lost.
    let loseStart = true;
    let loseLatest = true;
    await page.route('**/rest/v1/rpc/start_quiz_attempt**', async (route) => {
      if (!loseStart) return route.fallback();
      loseStart = false;
      await route.fetch();
      return route.abort('failed');
    });
    await page.route(`**/rest/v1/quiz_submissions?*quiz_id=eq.${s.quiz}*`, (route) => {
      if (route.request().method() !== 'GET' || !loseLatest) return route.fallback();
      loseLatest = false;
      return route.abort('failed');
    });
    await page.getByRole('button', { name: /retake quiz/i }).click();
    await expect(page.getByText("Couldn't confirm whether your attempt started")).toBeVisible({ timeout: 30000 });
    await shoot('U1-start-uncertain', 'fault');
    expect(readLedger(s.quiz, 'U1-during').attempts).toHaveLength(2); // the server did commit attempt 2

    await page.getByRole('button', { name: /retry/i }).click();
    await expect(page.getByText(/Attempt 2 of 2/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('radio', { name: 'Four', exact: true })).not.toBeChecked();
    await choose(page, 'Three');
    await next(page);
    await expect(page.getByRole('radio', { name: 'Red', exact: true })).not.toBeChecked();
    await choose(page, 'Blue');
    await submit(page);
    await expect(page.getByTestId('quiz-player-review')).toBeVisible({ timeout: 30000 });

    const l = readLedger(s.quiz, 'U1');
    expect(l.attempts.map((a) => a.attempt)).toEqual([1, 2]);
    expect(l.attempts[0]).toEqual(first.attempts[0]);
    expect([answerOf(l, 1, s.q1), answerOf(l, 1, s.q2)]).toEqual([s.four, s.red]);
    expect([answerOf(l, 2, s.q1), answerOf(l, 2, s.q2)]).toEqual([s.three, s.blue]);
    expect(net.filter((e) => e.kind === 'start' && e.phase === 'sent')).toHaveLength(2);
  });

  test('U2 score commits, response and read-back lost: blocked until a read confirms, scored once', async ({ learner: page, net, shoot }) => {
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
      await route.fetch();
      return route.abort('failed');
    });
    await page.route('**/rest/v1/quiz_submissions?*id=eq.*', (route) => {
      const u = route.request().url();
      if (route.request().method() !== 'GET' || !loseReadback || u.includes('quiz_id=')) return route.fallback();
      return route.abort('failed');
    });
    await submit(page);
    await expect(page.getByText("Couldn't confirm whether your quiz was submitted")).toBeVisible({ timeout: 30000 });
    await shoot('U2-submit-uncertain', 'fault');

    const blockedAt = Date.now();
    const during = readLedger(s.quiz, 'U2-during');
    expect(during.attempts[0]).toMatchObject({ state: 'complete', score: '2' }); // the server did finalize
    await page.waitForTimeout(3000); // longer than the 2 s autosave debounce
    const stillDuring = readLedger(s.quiz, 'U2-during-later');
    expect(stillDuring.answers).toEqual(during.answers);
    expect(net.filter((e) => e.kind === 'write' && e.at >= blockedAt)).toHaveLength(0);
    expect(net.filter((e) => e.kind === 'progress' && e.phase === 'sent')).toHaveLength(0);
    await expect(page.getByRole('button', { name: /submit quiz/i })).toHaveCount(0);

    loseReadback = false;
    await page.getByRole('button', { name: /retry/i }).click();
    await expect(page.getByText('2 / 2 points')).toBeVisible({ timeout: 30000 });
    await expect.poll(() => readLedger(s.quiz, 'U2').progress.length, { timeout: 15000 }).toBe(1);
    expect(net.filter((e) => e.kind === 'score' && e.phase === 'sent')).toHaveLength(1);
  });
});

test.describe(FAULT('delay'), () => {
  test('U3 leave mid-save and return: the old write settles before score-quiz is sent', async ({ learner: page, net }) => {
    const s = scenario('1a');
    let release!: () => void;
    const released = new Promise<void>((r) => { release = r; });
    let held = false;
    await page.route('**/rest/v1/quiz_submission_answers**', async (route) => {
      if (route.request().method() !== 'POST' || held) return route.fallback();
      held = true;
      await released;
      return route.fallback();
    });
    await open(page, '1a');
    await choose(page, 'Four');
    await expect.poll(() => held, { timeout: 15000 }).toBe(true); // the debounced write is in flight and held
    await page.getByText('QLC F1 limit one', { exact: true }).filter({ visible: true }).first().click(); // leave
    await page.getByText('QLC U3 remount write', { exact: true }).filter({ visible: true }).first().click(); // return
    setTimeout(() => release(), 1000);
    await expect(page.getByRole('radio', { name: 'Four', exact: true })).toBeChecked({ timeout: 30000 });
    await next(page);
    await choose(page, 'Blue');
    await submit(page);
    await expect(page.getByTestId('quiz-player-review')).toBeVisible({ timeout: 30000 });

    const scoreSent = net.findIndex((e) => e.kind === 'score' && e.phase === 'sent');
    const lastWriteSettled = net.map((e, i) => (e.kind === 'write' && e.phase !== 'sent' ? i : -1)).reduce((m, i) => Math.max(m, i), -1);
    const writesSent = net.filter((e) => e.kind === 'write' && e.phase === 'sent').length;
    const writesSettled = net.filter((e) => e.kind === 'write' && e.phase !== 'sent').length;
    expect(scoreSent).toBeGreaterThan(-1);
    expect(writesSettled).toBe(writesSent);
    expect(lastWriteSettled).toBeLessThan(scoreSent);
    const l = readLedger(s.quiz, 'U3');
    expect(l.attempts).toHaveLength(1);
    expect(l.attempts[0]).toMatchObject({ state: 'complete', score: '2' });
    expect([answerOf(l, 1, s.q1), answerOf(l, 1, s.q2)]).toEqual([s.four, s.blue]);
  });
});
