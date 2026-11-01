// ABOUTME: MOCKED egress self-test in a real Chromium: the mode's browser args, context gate, observers and
// ABOUTME: forwardApproved() refuse direct, redirected, new-page, worker and forwarded traffic to a non-approved origin.
// The app and the "external" host are tiny local servers started by egress-selftest.sh; the external one listens on a
// NON-loopback address of this machine and counts hits, which the wrapper requires to be 0. No Supabase stack.
// The console-error fixture is replaced by a no-op here only: these tests provoke failed requests on purpose, and each
// asserts the exact egress violation itself before clearing it.
import { test as gated, expect } from '../../../../e2e/quiz-lifecycle/session.fixture';

const test = gated.extend<{ consoleErrors: unknown }>({
  consoleErrors: async ({}, use) => { await use(undefined); }, // overrides the auto fixture; stays auto
});
const EXT = process.env.QLC_EXT_URL!; // http://<non-loopback ip>:<port>

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

test('forwardApproved refuses a non-approved origin before fetching', async ({ page, egress, forwardApproved }) => {
  await page.route(`${EXT}/**`, async (route) => { await forwardApproved(route); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (u) => { try { await fetch(`${u}/hit`); } catch { /* expected */ } }, EXT);
  await expectViolation(egress, /forward to a non-approved origin/);
});

test('forwardApproved refuses a 3xx from an approved origin', async ({ page, egress, forwardApproved }) => {
  await page.route('**/redirect', async (route) => { await forwardApproved(route); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { try { await fetch('/redirect'); } catch { /* expected */ } });
  await expectViolation(egress, /answered 302 \(redirects refused\)/);
});
