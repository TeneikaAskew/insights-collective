// ABOUTME: MOCKED readiness self-test in a real Chromium against a loopback stand-in for the learn page and its course GET:
// ABOUTME: target-identity positives and negatives, an aborted navigation, and the vacuous old-wait control.
import { test, expect } from '@playwright/test';
import { gotoReady, expectMounted } from '../../../../e2e/quiz-lifecycle/readiness';

const BASE = process.env.QLC_READINESS_BASE!;
const OK = '9c000000-0000-4000-8000-000000000001';
const PRIV = '9c009900-0000-4000-8000-0000000000c0';
const MOD = '9c000000-0000-4000-8000-000000000002';
const ITEM_26 = '9c002601-0000-4000-8000-000000000000';
const A = '9c001d01-0000-4000-8000-000000000000';
const B = '9c001e01-0000-4000-8000-000000000000';
const url = (c: string, item = ITEM_26) => `${BASE}/courses/${c}/learn/${MOD}/${item}`;
const noLeak = (msg: string | undefined) => {
  for (const leak of [PRIV, OK, A, B, 'secret-body-marker', 'Back to courses', 'QLC ', BASE, 'net::', 'http']) expect(msg).not.toContain(leak);
};
const fail = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e.message);

test('ready: course GET 200 with the expected id, then the target heading and player together', async ({ page }) => {
  await gotoReady(page, url(OK), 'ready', 10000);
  await expect(page.getByTestId('quiz-player-active')).toBeVisible();
});

test('not ready (H1-predicted shape, not observed in run 41359219343): 406 PGRST116 + "Course not found"', async ({ page }) => {
  const msg = await fail(gotoReady(page, url(PRIV), 'open-26', 5000));
  expect(msg).toBe('QLC-READINESS case=open-26 nav=ok route_template=true course_match=true item_match=true target_heading=false '
    + 'course_get[status=406 code=PGRST116 id_match=false] headings[h0=1,h1=0,h2=0,h3=0] '
    + 'states[loading=0,empty=0,active=0,review=0,exhausted=0]');
  noLeak(msg ?? undefined);
});

test('causal control: the OLD wait (loading count 0) passes vacuously on the same not-ready page', async ({ page }) => {
  await page.goto(url(PRIV), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quiz-player-loading')).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByText('Course not found', { exact: true })).toBeVisible();
});

test('not ready: course readable but the player is empty', async ({ page }) => {
  const msg = await fail(gotoReady(page, url(OK) + '?empty=1', 'open-empty', 3000));
  expect(msg).toContain('course_get[status=200 code=none id_match=true]');
  expect(msg).toContain('target_heading=true');
  expect(msg).toContain('states[loading=0,empty=1,active=0,review=0,exhausted=0]');
});

test('navigation abort: classified into the fixed line, no raw Playwright error or URL', async ({ page }) => {
  await page.route(`${BASE}/courses/**`, (r) => (r.request().resourceType() === 'document' ? r.abort('aborted') : r.fallback()));
  const msg = await fail(gotoReady(page, url(OK), 'open-abort', 5000));
  expect(msg).toMatch(/^QLC-READINESS case=open-abort nav=aborted route_template=(true|false) /);
  expect(msg).toContain('course_get[not_observed]');
  noLeak(msg ?? undefined);
});

test('negative: readable course, URL already on B, but the PREVIOUS item (A) is still mounted', async ({ page }) => {
  await gotoReady(page, url(OK, A), 'R3-A-start', 10000);
  // The race window: history updated before the app re-rendered. A's heading and active player are still on screen.
  await page.evaluate((b) => { const p = location.pathname.split('/'); p[5] = b; history.pushState({}, '', p.join('/')); }, B);
  const msg = await fail(expectMounted(page, 'R3-B', { item: B }, 1500));
  expect(msg).toBe('QLC-READINESS case=R3-B nav=not_attempted route_template=true course_match=true item_match=true target_heading=false '
    + 'course_get[not_observed] headings[h0=0,h1=0,h2=0,h3=0] states[loading=0,empty=0,active=1,review=0,exhausted=0]');
  noLeak(msg ?? undefined);
});

test('positive: a real in-app transition A -> B passes only once B heading and B player are ready', async ({ page }) => {
  await gotoReady(page, url(OK, A), 'R3-A-start', 10000);
  await page.getByText('QLC R3 slow start B', { exact: true }).first().click();
  await expectMounted(page, 'R3-B', { item: B }, 5000);
  await expect(page.locator('h1')).toHaveText('QLC R3 slow start B');
  await expect(page.getByTestId('quiz-player-active')).toBeVisible();
});

test('negative: wrong expected item while A is mounted (no transition) fails', async ({ page }) => {
  await gotoReady(page, url(OK, A), 'R3-A-start', 10000);
  const msg = await fail(expectMounted(page, 'wrong-item', { item: B }, 1000));
  expect(msg).toContain('item_match=false target_heading=false');
});
