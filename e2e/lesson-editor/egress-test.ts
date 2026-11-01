// ABOUTME: Playwright `test` with the lesson-editor egress boundary wired in: the worker's Chromium is launched through the
// ABOUTME: allowlist proxy (loopback forced through it) and every context gets the route/WebSocket/observation boundary.
//
// The allowed origins come from LE_ALLOWED_ORIGINS (comma-separated exact origins) or, for the lesson-editor spec, from
// LE_APP_ORIGIN and LE_API_ORIGIN. Test end fails on any page-level boundary violation; every proxy refusal is recorded.
// LE_EGRESS_CONTROL (off | route-only | proxy-only) weakens the boundary ONLY for the self-test's causal controls; the
// lesson-editor spec refuses to run when it is set.
import { test as base, expect } from '@playwright/test';
import { allowedOrigins, installBoundary, type Boundary } from './egress-boundary';
import { startEgressProxy, type EgressProxy } from './egress-proxy';

// Controls (self-test only): off = no layer but the resolver; route-only = no proxy; proxy-only = no route/WebSocket layer.
const CONTROL = process.env.LE_EGRESS_CONTROL ?? '';
if (!['', 'off', 'route-only', 'proxy-only'].includes(CONTROL)) throw new Error('LE_EGRESS_CONTROL: unknown value');
export const CONTROL_OFF = CONTROL !== '';
const PROXY_ON = CONTROL === '' || CONTROL === 'proxy-only';
const ROUTE_ON = CONTROL === '' || CONTROL === 'route-only';
export function configuredOrigins(): string[] {
  const list = process.env.LE_ALLOWED_ORIGINS ? process.env.LE_ALLOWED_ORIGINS.split(',') : [process.env.LE_APP_ORIGIN, process.env.LE_API_ORIGIN];
  return list.filter((o): o is string => Boolean(o));
}

export const test = base.extend<{ boundary: Boundary }, { egressProxy: EgressProxy | null }>({
  egressProxy: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their (empty) dependencies
    async ({}, use) => {
      if (!PROXY_ON) return use(null);
      const origins = configuredOrigins();
      if (!origins.length) throw new Error('egress boundary: no allowed origins configured');
      const p = await startEgressProxy(allowedOrigins(...origins));
      await use(p);
      await p.close();
    },
    { scope: 'worker' },
  ],
  browser: [
    async ({ playwright, launchOptions, egressProxy }, use) => {
      const b = await playwright.chromium.launch({
        ...launchOptions,
        ...(egressProxy ? { proxy: { server: egressProxy.url, bypass: '<-loopback>' } } : {}),
      });
      await use(b);
      await b.close();
    },
    { scope: 'worker' },
  ],
  boundary: [
    async ({ context, egressProxy }, use) => {
      const b = !ROUTE_ON ? { violations: [], aborted: 0 } : await installBoundary(context, allowedOrigins(...configuredOrigins()));
      const refusedBefore = egressProxy?.refused.length ?? 0;
      await use(b);
      const refused = egressProxy ? egressProxy.refused.slice(refusedBefore) : [];
      test.info().annotations.push({ type: 'egress', description: JSON.stringify({ violations: b.violations, proxyRefused: refused }) });
      // Page-level violations fail the test. Proxy refusals were PREVENTED (nothing was forwarded); they are recorded, and
      // most are Chromium's own background traffic (update/accounts services) that page.route() never sees.
      if (!test.info().annotations.some((a) => a.type === 'expect-egress-violations')) {
        expect(b.violations, 'egress boundary violations').toEqual([]);
      }
    },
    { auto: true },
  ],
});
export { expect };
