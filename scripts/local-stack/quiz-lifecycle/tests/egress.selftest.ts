// ABOUTME: MOCKED egress self-test in a real Chromium: the mode's browser args, context gate, observers and
// ABOUTME: forwardApproved() refuse direct, redirected, new-page, worker and forwarded traffic to a non-approved origin.
// The app and the "external" host are tiny local servers started by egress-selftest.sh; the external one listens on a
// NON-loopback address of this machine and counts hits, which the wrapper requires to be 0. No Supabase stack.
// The console-error fixture is replaced by a no-op here only: these tests provoke failed requests on purpose, and each
// asserts the exact egress violation itself before clearing it.
import fs from 'node:fs';
import type { BrowserContext, Page } from '@playwright/test';
import { test as gated, expect, type RefusalProxy } from '../../../../e2e/quiz-lifecycle/session.fixture';

const test = gated.extend<{ consoleErrors: unknown }>({
  // Overrides the auto fixture (stays auto). `page` is named only to avoid an empty destructuring pattern.
  consoleErrors: async ({ page: _page }, use) => { await use(undefined); },
});
const EXT = process.env.QLC_EXT_URL!; // http://<non-loopback ip>:<port>
const LOOP = process.env.QLC_LOOP_URL!; // http://127.0.0.1:<third port>, NOT approved; its sink counts hits
const loopHost = new URL(LOOP).host;
const loopHits = () => fs.readFileSync(process.env.QLC_LOOP_HITS!, 'utf8').split('\n').filter(Boolean).length;
const served302 = () => fs.readFileSync(process.env.QLC_APP_LOG!, 'utf8').split('\n').filter((l) => l === '302 /redirect-loopback').length;

/**
 * approved -> 302 -> unapproved third loopback port. Route interception does not see the redirect hop, so this is the
 * proxy layer alone. Retries (bounded) only while the browser has not yet RECEIVED the 302; then requires: the app
 * served it, the browser received it, the refusal proxy got the hop, and the third-port sink got nothing.
 */
async function provesLoopRedirectConfined(page: Page, context: BrowserContext, refusalProxy: RefusalProxy,
  egress: { violations: string[] }, act: () => Promise<unknown>) {
  let got302 = 0;
  context.on('response', (r) => { if (r.status() === 302 && new URL(r.url()).pathname === '/redirect-loopback') got302 += 1; });
  const servedBefore = served302();
  for (let i = 0; i < 5 && got302 === 0; i += 1) {
    await act();
    await expect.poll(() => got302, { timeout: 1000 }).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(got302, 'the browser never received the 302, so the redirect path was not exercised').toBeGreaterThan(0);
  expect(served302()).toBeGreaterThan(servedBefore);
  await expect.poll(() => refusalProxy.destinations.includes(loopHost), { timeout: 5000 }).toBe(true);
  expect(loopHits()).toBe(0);
  await expectViolation(egress, new RegExp(`refusal proxy received a request for ${loopHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
}

async function expectViolation(egress: { violations: string[] }, pattern: RegExp) {
  await expect.poll(() => egress.violations.some((v) => pattern.test(v)), { timeout: 10000 }).toBe(true);
  egress.violations.length = 0; // asserted; clear so teardown checks only unexpected violations
}

test('approved loopback traffic passes with no violation', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(async () => (await fetch('/ok')).status)).toBe(200);
});

test('direct fetch to a non-approved origin is blocked and recorded', async ({ page, egress }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(async (u) => { try { await fetch(`${u}/hit`); return 'reached'; } catch { return 'blocked'; } }, EXT);
  expect(r).toBe('blocked');
  await expectViolation(egress, /non-approved origin/);
});

test('a loopback redirect to a non-approved origin is refused and recorded (fetch)', async ({ page, context, egress }) => {
  // Measured: Chromium occasionally fails the loopback request itself (ERR_PROXY_CONNECTION_FAILED) before the server
  // answers, so no 302 ever reaches the browser and there is nothing to refuse. That outcome proves nothing, so the
  // case retries (bounded) until the browser has actually received the 302, then requires the refusal and violation.
  let got302 = 0;
  context.on('response', (r) => { if (r.status() === 302 && new URL(r.url()).pathname === '/redirect') got302 += 1; });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const outcomes: string[] = [];
  for (let i = 0; i < 5 && got302 === 0; i += 1) {
    outcomes.push(await page.evaluate(async () => { try { const x = await fetch('/redirect'); return x.ok ? 'reached' : 'not-ok'; } catch { return 'blocked'; } }));
    await expect.poll(() => got302, { timeout: 1000 }).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(got302, 'the browser never received the 302, so the redirect path was not exercised').toBeGreaterThan(0);
  expect(outcomes).not.toContain('reached');
  await expectViolation(egress, /3xx response|redirect hop|non-approved origin/);
});

test('fetch: approved -> 302 -> unapproved THIRD loopback port never reaches its sink', async ({ page, context, refusalProxy, egress }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await provesLoopRedirectConfined(page, context, refusalProxy, egress, async () => {
    const r = await page.evaluate(async () => { try { const x = await fetch('/redirect-loopback'); return (await x.text()).includes('loop sink') ? 'reached' : 'not-reached'; } catch { return 'blocked'; } });
    expect(r).not.toBe('reached');
  });
});

test('navigation: approved -> 302 -> unapproved THIRD loopback port never reaches its sink', async ({ page, context, refusalProxy, egress }) => {
  await provesLoopRedirectConfined(page, context, refusalProxy, egress, async () => {
    await page.goto('/redirect-loopback', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  });
});

test('a navigation redirect to a non-approved origin is refused and recorded', async ({ page, egress }) => {
  await page.goto('/redirect', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  await expectViolation(egress, /3xx response|redirect hop|non-approved origin/);
});

test('a new page to a non-approved origin is recorded and cannot reach it', async ({ page, egress }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((u) => { window.open(`${u}/hit`, '_blank'); }, EXT);
  await expectViolation(egress, /additional page|non-approved origin/);
});

test('service workers never start (register() is a no-op stub under serviceWorkers: block)', async ({ page, context }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { regs: 0, controller: false };
    try { await navigator.serviceWorker.register('/sw.js'); } catch { /* refused is also fine */ }
    await new Promise((res) => setTimeout(res, 1000));
    const regs = await navigator.serviceWorker.getRegistrations();
    return { regs: regs.length, controller: !!navigator.serviceWorker.controller };
  });
  expect(r).toEqual({ regs: 0, controller: false });
  expect(context.serviceWorkers()).toHaveLength(0);
});

test('forwardApproved forwards approved traffic directly (control: not via the refusal proxy)', async ({ page, forwardApproved, refusalProxy }) => {
  let forwarded = 0;
  await page.route('**/ok', async (route) => { const r = await forwardApproved(route); if (r) { forwarded += 1; await route.fulfill(r); } });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const before = refusalProxy.destinations.length;
  expect(await page.evaluate(async () => { const x = await fetch('/ok'); return `${x.status} ${await x.text()}`; })).toBe('200 ok');
  expect(forwarded).toBe(1);
  expect(refusalProxy.destinations.length).toBe(before);
});

test('forwardApproved refuses a non-approved origin before fetching', async ({ page, egress, forwardApproved }) => {
  await page.route(`${EXT}/**`, async (route) => { const r = await forwardApproved(route); if (r) await route.fulfill(r); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (u) => { try { await fetch(`${u}/hit`); } catch { /* expected */ } }, EXT);
  await expectViolation(egress, /forward to a non-approved origin/);
});

test('forwardApproved refuses a 3xx from an approved origin', async ({ page, egress, forwardApproved }) => {
  await page.route('**/redirect', async (route) => { const r = await forwardApproved(route); if (r) await route.fulfill(r); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { try { await fetch('/redirect'); } catch { /* expected */ } });
  await expectViolation(egress, /answered 302 \(redirects refused\)/);
});
