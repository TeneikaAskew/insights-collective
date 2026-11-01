// ABOUTME: Real-Chromium self-test of egress-boundary.ts with NO stack: loopback test servers only. Proves each layer blocks, and an
// ABOUTME: unprotected control (LE_EGRESS_CONTROL=off) shows the same probes DO reach the forbidden server, so the test can fail.
// Run: npx playwright test -c e2e/lesson-editor/playwright.egress-selftest.config.ts   (control: LE_EGRESS_CONTROL=off, expected red)
import { test, expect, CONTROL_OFF } from './egress-test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';
let allowedSrv: http.Server, forbiddenSrv: http.Server, wss: WebSocketServer;
let A = '', F = '';
const forbiddenHits: string[] = [];

test.beforeAll(async () => {
  forbiddenSrv = http.createServer((req, res) => {
    forbiddenHits.push(req.url ?? '');
    res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    res.end('<p>forbidden</p>');
  });
  await new Promise<void>((r) => forbiddenSrv.listen(0, '127.0.0.1', r));
  F = `http://127.0.0.1:${(forbiddenSrv.address() as AddressInfo).port}`;
  wss = new WebSocketServer({ server: forbiddenSrv });
  wss.on('connection', () => forbiddenHits.push('ws'));
  allowedSrv = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: `${F}/after-redirect` });
      return res.end();
    }
    if (req.url === '/sw.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(`self.addEventListener('fetch', () => {});`);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>allowed</title><p>allowed</p>');
  });
  await new Promise<void>((r) => allowedSrv.listen(0, '127.0.0.1', r));
  A = `http://127.0.0.1:${(allowedSrv.address() as AddressInfo).port}`;
  process.env.LE_ALLOWED_ORIGINS = A; // read by the worker proxy and the boundary when the browser is first requested
});
test.afterAll(async () => {
  wss?.close();
  await new Promise((r) => forbiddenSrv?.close(r));
  await new Promise((r) => allowedSrv?.close(r));
});

test('every probe to a non-allowed origin is stopped before it reaches the server', async ({ context, page, boundary: b, egressProxy }) => {
  test.info().annotations.push({ type: 'expect-egress-violations', description: 'this test provokes them on purpose' });
  await page.goto(`${A}/`);
  const probe = (name: string, fn: string) => page.evaluate(fn).catch(() => `${name}: threw`);
  await probe('fetch', `fetch('${F}/fetch').then(r => r.status, () => 'failed')`);
  await probe('img', `new Promise(r => { const i = new Image(); i.onload = i.onerror = () => r('done'); i.src = '${F}/img'; })`);
  await probe('beacon', `navigator.sendBeacon('${F}/beacon', 'x')`);
  await probe('hostname', `fetch('http://forbidden.invalid/', { mode: 'no-cors' }).then(() => 'ok', () => 'failed')`);
  await probe('redirect', `fetch('${A}/redirect').then(r => r.status, () => 'failed')`);
  await probe('ws', `new Promise(r => { const w = new WebSocket('${F.replace('http', 'ws')}/ws'); w.onopen = () => r('open'); w.onerror = w.onclose = () => r('closed'); setTimeout(() => r('timeout'), 3000); })`);
  await probe('sw', `navigator.serviceWorker ? navigator.serviceWorker.register('/sw.js').then(() => 'registered', () => 'refused') : 'absent'`);
  const popupP = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await probe('popup', `window.open('${F}/popup', '_blank') ? 'opened' : 'blocked'`);
  const popup = await popupP;
  if (popup) await popup.waitForLoadState('domcontentloaded').catch(() => {});
  const tab2 = await context.newPage(); // a second tab of the same context
  await tab2.goto(`${F}/second-tab`).catch(() => {});
  await page.goto(`${F}/navigate`).catch(() => {});
  await page.waitForTimeout(500);

  const refused = egressProxy?.refused ?? [];
  test.info().annotations.push({ type: 'forbiddenHits', description: JSON.stringify(forbiddenHits) });
  test.info().annotations.push({ type: 'observed', description: JSON.stringify({ violations: b.violations, refused }) });
  console.log(`forbiddenHits=${JSON.stringify(forbiddenHits)}\nviolations=${JSON.stringify(b.violations)}\nproxyRefused=${JSON.stringify(refused)}`);
  expect(forbiddenHits, 'nothing reached the forbidden loopback server').toEqual([]);
  // Records carry an origin only, never a path.
  for (const v of [...b.violations, ...refused]) expect(v).not.toMatch(/\/(fetch|img|beacon|popup|navigate|second-tab|after-redirect|ws)\b/);
  expect(b.violations.filter((v) => v === `blocked ${F}`).length, 'route layer aborted the direct probes').toBeGreaterThanOrEqual(5);
  expect(b.violations.some((v) => v === `blocked websocket ${F.replace('http', 'ws')}`), 'websocket layer').toBe(true);
  expect(b.violations.some((v) => v === `redirect to ${F}`), 'the redirect hop is observed').toBe(true);
  expect(refused.some((v) => v === `refused ${F}`), 'the proxy refused the redirect hop').toBe(true);
});
