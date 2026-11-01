// ABOUTME: MOCKED readiness self-test in a real Chromium against a loopback stand-in for the learn page and its course GET:
// ABOUTME: the ready page passes, the run 41359219343 shape throws one exact redacted line, and the old wait passes vacuously.
import { test, expect } from '@playwright/test';
import { gotoReady } from '../../../../e2e/quiz-lifecycle/readiness';

const BASE = process.env.QLC_READINESS_BASE!;
const OK = '9c000000-0000-4000-8000-000000000001';
const PRIV = '9c009900-0000-4000-8000-0000000000c0';
const url = (c: string) => `${BASE}/courses/${c}/learn/9c000000-0000-4000-8000-000000000002/9c002601-0000-4000-8000-000000000000`;

test('ready: course GET 200 with the expected id, then a mounted player state', async ({ page }) => {
  await gotoReady(page, url(OK), 'ready', 10000);
  await expect(page.getByTestId('quiz-player-active')).toBeVisible();
});

test('not ready (run 41359219343 shape): 406 PGRST116 + "Course not found" throws the exact redacted line', async ({ page }) => {
  const err = await gotoReady(page, url(PRIV), 'open-26', 5000).then(() => null, (e: Error) => e);
  expect(err?.message).toBe('QLC-READINESS case=open-26 route_template=true course_match=true item_match=true '
    + 'course_get[status=406 code=PGRST116 id_match=false] headings[h0=1,h1=0,h2=0,h3=0] '
    + 'states[loading=0,empty=0,active=0,review=0,exhausted=0]');
  for (const leak of [PRIV, 'secret-body-marker', 'Back to courses', BASE]) expect(err?.message).not.toContain(leak);
});

test('causal control: the OLD wait (loading count 0) passes vacuously on the same not-ready page', async ({ page }) => {
  await page.goto(url(PRIV), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quiz-player-loading')).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByText('Course not found', { exact: true })).toBeVisible();
});

test('not ready: course readable but the player never mounts (empty state) also throws', async ({ page }) => {
  const err = await gotoReady(page, url(OK) + '?empty=1', 'open-empty', 3000).then(() => null, (e: Error) => e);
  expect(err?.message).toContain('course_get[status=200 code=none id_match=true]');
  expect(err?.message).toContain('states[loading=0,empty=1,active=0,review=0,exhausted=0]');
});
