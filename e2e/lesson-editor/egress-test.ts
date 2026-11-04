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
import { readFileSync } from 'node:fs';
import { postrunAppArmor, postrunAppArmorObserved, readLabelAttempts, withSandboxedBrowser } from './sandbox-launch.mjs';

// Controls (self-test only): off = no layer but the resolver; route-only = no proxy; proxy-only = no route/WebSocket layer.
const CONTROL = process.env.LE_EGRESS_CONTROL ?? '';
if (!['', 'off', 'route-only', 'proxy-only'].includes(CONTROL)) throw new Error('LE_EGRESS_CONTROL: unknown value');
export const CONTROL_OFF = CONTROL !== '';
const PROXY_ON = CONTROL === '' || CONTROL === 'proxy-only';
const ROUTE_ON = CONTROL === '' || CONTROL === 'route-only';
// LE_ALLOWED_ORIGINS is the SELF-TEST's allowlist. It is refused whenever any lesson-editor target is configured, so the
// authentic path's allowlist is always exactly LE_APP_ORIGIN + LE_API_ORIGIN (the spec also refuses it at load).
const TARGET_VARS = ['LE_APP_ORIGIN', 'LE_API_ORIGIN', 'LE_DB_URL', 'LE_WORK_DIR', 'LE_EVIDENCE_DIR'];
export function configuredOrigins(): string[] {
  if (process.env.LE_ALLOWED_ORIGINS !== undefined && TARGET_VARS.some((k) => process.env[k] !== undefined)) {
    throw new Error('LE_ALLOWED_ORIGINS (self-test allowlist) is refused when a lesson-editor target is configured');
  }
  const list = process.env.LE_ALLOWED_ORIGINS ? process.env.LE_ALLOWED_ORIGINS.split(',') : [process.env.LE_APP_ORIGIN, process.env.LE_API_ORIGIN];
  return list.filter((o): o is string => Boolean(o));
}

type AppArmorState = Parameters<typeof postrunAppArmor>[0];
/** AppArmor label of this worker ('self') or of a process, as text; null when unreadable (fails closed in the gate).
 *  The first successful read is returned, even blank; the fallback file is tried only after the primary throws. E1
 *  diagnostics r2: `note`, when given, receives the closed outcome of each of THESE attempts ([primary, fallback]); it adds
 *  no read and its own failure changes nothing. */
export function readLabel(who: number | 'self', note?: (outcomes: string[]) => void): string | null {
  return readLabelAttempts((p: string) => readFileSync(p, 'utf8'), who, note);
}
// The authentic lane's worker-side AppArmor state, set by the browser fixture once the owned browser is attested and gated.
let laneAppArmor: AppArmorState | null = null;
const authenticLane = () => TARGET_VARS.some((k) => process.env[k] !== undefined);

export const test = base.extend<{ boundary: Boundary; laneAppArmorGate: void }, { egressProxy: EgressProxy | null }>({
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
  // The worker browser: launchServer with the Chromium sandbox ON (chromiumSandbox: true, written last), the closed incoming and
  // EFFECTIVE option contract, the owned-browser argv attestation before any navigation, and awaited bounded cleanup on every
  // path (sandbox-launch.mjs). No launch()/launchPersistentContext fallback and no retry without the sandbox.
  browser: [
    async ({ playwright, launchOptions, egressProxy }, use) => {
      // The authentic lane (a lesson-editor target is configured) binds the pinned shell and confines Playwright's artifacts to
      // the private output dir; the self-test (LE_ALLOWED_ORIGINS) keeps the same sandbox and option closure without those binds.
      const authentic = authenticLane();
      if (authentic && !egressProxy) throw new Error('LANE_E_SANDBOX_OPTION');
      const shell = authentic ? (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '') : (launchOptions.executablePath ?? '');
      const outputDir = authentic ? (process.env.LE_OUTPUT_DIR ?? '') : '';
      if (authentic && (!shell || !outputDir)) throw new Error('LANE_E_SANDBOX_OPTION');
      const defaults = (playwright as unknown as { _defaultLaunchOptions?: Record<string, unknown> })._defaultLaunchOptions;
      await withSandboxedBrowser(playwright.chromium, {
        launchOptions: launchOptions as Record<string, unknown>, defaults, shell, outputDir, proxyUrl: egressProxy?.url ?? null,
        readCmdline: (pid: number) => readFileSync(`/proc/${pid}/cmdline`, 'latin1'),
        // Authentic lane only: worker label gated before launch, owned-browser label after attestation, both again after use.
        ...(authentic ? { readLabel, onAppArmor: (s: AppArmorState) => { laneAppArmor = s; } } : {}),
      }, use);
    },
    { scope: 'worker' },
  ],
  // Authentic lane only: after each test, the worker and owned-browser AppArmor labels are read again and must equal the
  // pre-launch ENFORCE codes; the fixed line goes to the `lane-apparmor` annotation (the supervisor's lane.txt reads it from the
  // JSON report). A missing pre state or any mismatch fails the test.
  laneAppArmorGate: [
    async ({ browser }, use) => {
      void browser;
      if (!authenticLane()) return use();
      const state = laneAppArmor;
      if (!state) throw new Error('LANE_E_APPARMOR_PRE');
      await use();
      const post = postrunAppArmorObserved(state); // same reads and decision as postrunAppArmor, plus the closed observation
      test.info().annotations.push({ type: 'lane-apparmor', description: post.line });
      test.info().annotations.push({ type: 'lane-post-observed', description: post.observed }); // diagnostic only (E1 diagnostics r2)
      if (!post.ok) throw new Error('LANE_E_APPARMOR_POST');
    },
    { auto: true },
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
