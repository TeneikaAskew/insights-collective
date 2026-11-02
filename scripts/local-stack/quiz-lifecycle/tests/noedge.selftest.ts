// ABOUTME: MOCKED no-Edge guard self-test in a real Chromium: the context route and forwardApproved() REFUSE Edge Function paths
// ABOUTME: and direct quiz_submissions writes BEFORE forwarding; an owned API sink (the approved API origin) must get zero calls.
// The app and the API sink are tiny loopback servers started by noedge-selftest.sh; the sink logs "METHOD URL" per request.
// Every request carries ?probe=<tag>, so the wrapper and the tests count sink calls per case. QLC_NO_EDGE=1 runs the refusal
// and positive cases; with QLC_NO_EDGE unset only the inactive control runs, and the SAME forbidden requests must reach the sink.
import fs from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { test as gated, expect, type Forwarded } from '../../../../e2e/quiz-lifecycle/session.fixture';

const test = gated.extend<{ consoleErrors: unknown }>({
  consoleErrors: async ({ page: _page }, use) => { await use(undefined); },
});
const SINK = new URL(process.env.VITE_SUPABASE_URL!).origin;
const ACTIVE = process.env.QLC_NO_EDGE === '1';
const sinkCalls = (tag: string) => fs.readFileSync(process.env.QLC_SINK_HITS!, 'utf8').split('\n').filter((l) => l.includes(`probe=${tag}&`) || l.endsWith(`probe=${tag}`)).length;

export const FORBIDDEN: Array<[string, string]> = [
  ['POST', '/functions/v1/score-quiz'], ['OPTIONS', '/functions/v1/score-quiz'], ['GET', '/functions/v1'], ['GET', '/functions/v1/'],
  ['GET', '/FUNCTIONS/v1/score-quiz'], ['GET', '/functions/v1%2Fscore-quiz'],
  ['POST', '/rest/v1/quiz_submissions'], ['PATCH', '/rest/v1/quiz_submissions'], ['PUT', '/rest/v1/quiz_submissions'],
  ['DELETE', '/rest/v1/quiz_submissions'], ['POST', '/rest/v1/quiz_submissions/'], ['POST', '/rest/v1/quiz%5Fsubmissions'],
];
const ALLOWED: Array<[string, string, boolean]> = [ // method, path, preflighted (Authorization header)
  ['GET', '/rest/v1/quiz_submissions', true], ['HEAD', '/rest/v1/quiz_submissions', false],
  ['POST', '/rest/v1/rpc/start_quiz_attempt', true], ['POST', '/rest/v1/quiz_submission_answers', true], ['GET', '/functions/v1x', false],
];

async function send(page: Page, method: string, path: string, tag: string, auth = false) {
  return page.evaluate(async ({ u, m, a }) => {
    const headers: Record<string, string> = {};
    if (a) headers.authorization = 'Bearer selftest-not-a-token';
    if (!['GET', 'HEAD'].includes(m)) headers['content-type'] = 'application/json';
    try { const r = await fetch(u, { method: m, headers, body: ['GET', 'HEAD'].includes(m) ? undefined : '{}' }); return r.status; } catch { return 'blocked'; }
  }, { u: `${SINK}${path}?probe=${tag}`, m: method, a: auth });
}
async function expectRefusal(egress: { violations: string[] }, pattern: RegExp) {
  await expect.poll(() => egress.violations.some((v) => pattern.test(v)), { timeout: 5000 }).toBe(true);
  egress.violations.length = 0;
}
const forwardAll = (forwardApproved: (r: Route) => Promise<Forwarded | null>) => async (route: Route) => {
  if (!route.request().url().startsWith(SINK)) return route.fallback();
  const res = await forwardApproved(route);
  if (res) await route.fulfill(res);
};

test.describe('ACTIVE (QLC_NO_EDGE=1)', () => {
  test.skip(!ACTIVE, 'active cases run only with QLC_NO_EDGE=1');
  FORBIDDEN.forEach(([m, p], i) => {
    test(`context route refuses ${m} ${p} before forwarding: zero sink calls`, async ({ page, egress }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(await send(page, m, p, `RF${i}`, true)).toBe('blocked');
      await expectRefusal(egress, /refused in no-Edge mode/);
      await page.waitForTimeout(300);
      expect(sinkCalls(`RF${i}`)).toBe(0);
    });
    test(`forwardApproved refuses ${m} ${p} before its fetch: zero sink calls`, async ({ page, egress, forwardApproved }) => {
      await page.route('**/*', forwardAll(forwardApproved)); // page route runs BEFORE the context route: the bypass path
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(await send(page, m, p, `FF${i}`, false)).toBe('blocked');
      await expectRefusal(egress, /forwardApproved: .*refused in no-Edge mode/);
      await page.waitForTimeout(300);
      expect(sinkCalls(`FF${i}`)).toBe(0);
    });
  });
  ALLOWED.forEach(([m, p, a], i) => {
    test(`positive: ${m} ${p} reaches the sink, no violation`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(await send(page, m, p, `RA${i}`, a)).toBe(200);
      expect(sinkCalls(`RA${i}`)).toBeGreaterThan(0);
    });
  });
  test('positive: forwardApproved forwards GET quiz_submissions and the start RPC (sink called, no violation)', async ({ page, forwardApproved }) => {
    await page.route('**/*', forwardAll(forwardApproved));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await send(page, 'GET', '/rest/v1/quiz_submissions', 'FA0', true)).toBe(200);
    expect(await send(page, 'POST', '/rest/v1/rpc/start_quiz_attempt', 'FA1', true)).toBe(200);
    expect(sinkCalls('FA0')).toBeGreaterThan(0);
    expect(sinkCalls('FA1')).toBeGreaterThan(0);
  });
});

test.describe('INACTIVE control (QLC_NO_EDGE unset)', () => {
  test.skip(ACTIVE, 'the inactive control runs only without QLC_NO_EDGE');
  FORBIDDEN.forEach(([m, p], i) => {
    test(`inactive: the same ${m} ${p} reaches the owned sink (the zero above is caused by the guard)`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await send(page, m, p, `IC${i}`, true);
      expect(sinkCalls(`IC${i}`)).toBeGreaterThan(0);
    });
  });
});
