// ABOUTME: Lifecycle-matrix SYNTHETIC arms A to D (LOCAL candidate, NOT RUN): four sequential, individually bounded arms against
// ABOUTME: an in-lane dummy page server, each with its own sandboxed browser and ONE context. Never E1 evidence or acceptance.
//
// Run only with playwright.lifecycle-matrix.config.ts inside the SYNTHETIC lane (LE_TARGET=SYNTHETIC). No app, API, Supabase,
// storage-state file, fixture write or credential exists in that lane. This file imports @playwright/test's BASE `test` (never
// egress-test.ts, whose auto `boundary` fixture would force a context), and its one test requests only the `playwright` and
// `launchOptions` fixtures: no page, context or browser fixture. The arms run inside ONE test because Playwright restarts the
// worker after any failed test, which would lose the "reap unproven, stop" state between arms; each arm keeps its own bound
// (lifecycle-matrix.mjs ARM_TIMEOUT_MS, equal to E1's test timeout). One `syn-arm` annotation per arm carries its closed line;
// the lane supervisor re-validates it before writing `LANE SYN ARM ...`.
// Refused at LOAD: any authentic target variable or Playwright's baseURL default source (DESIGN-r2.2 B).
for (const k of ['LE_APP_ORIGIN', 'LE_API_ORIGIN', 'LE_DB_URL', 'LE_DB_PASSWORD_FILE', 'LE_KEYS_DIR', 'LE_PROOF_FILE', 'LE_SOCK_DIR',
  'PLAYWRIGHT_TEST_BASE_URL', 'LE_ALLOWED_ORIGINS', 'LE_EGRESS_CONTROL']) {
  if (k in process.env) throw new Error(`lifecycle matrix refused: ${k} is set`);
}
if (process.env.LE_TARGET !== 'SYNTHETIC') throw new Error('lifecycle matrix refused: LE_TARGET is not SYNTHETIC');
import { test } from '@playwright/test';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { allowedOrigins, installBoundary } from './egress-boundary';
import { startEgressProxy } from './egress-proxy';
import { readLabelAttempts, withSandboxedBrowser } from './sandbox-launch.mjs';
import { ARM_TIMEOUT_MS, SYN_TEST_TIMEOUT_MS, dummyOriginOk, runMatrix, startDummyServer } from './lifecycle-matrix.mjs';

const readLabel = (who: number | 'self', note?: (outcomes: string[]) => void) => readLabelAttempts((p: string) => readFileSync(p, 'utf8'), who, note);

test.describe('lifecycle matrix (synthetic)', () => {
  test('arms A to D', async ({ playwright, launchOptions }) => {
    test.setTimeout(SYN_TEST_TIMEOUT_MS);
    const shell = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '';
    const outputDir = process.env.LE_OUTPUT_DIR ?? '';
    if (!shell || !outputDir) throw new Error('LANE_E_SANDBOX_OPTION');
    const defaults = (playwright as unknown as { _defaultLaunchOptions?: Record<string, unknown> })._defaultLaunchOptions;
    const dummy = await startDummyServer(http);
    let dummyAbsent = false, allDone = false;
    try {
      if (!dummyOriginOk(dummy.origin)) throw new Error('SYN_E_DUMMY');
      const allowed = allowedOrigins(dummy.origin);
      // ONE egress proxy for all arms (mirrors E1's worker-scoped proxy); its upstream set is exactly the dummy's origin pair.
      const proxy = await startEgressProxy(allowed);
      try {
        const r = await runMatrix({
          dummy: dummy.origin, allowed, timeoutMs: ARM_TIMEOUT_MS, installBoundary,
          withBrowser: (onState: (s: unknown) => void, use: (browser: import('@playwright/test').Browser) => Promise<unknown>) =>
            withSandboxedBrowser(playwright.chromium, {
              launchOptions: launchOptions as Record<string, unknown>, defaults, shell, outputDir, proxyUrl: proxy.url,
              readCmdline: (pid: number) => readFileSync(`/proc/${pid}/cmdline`, 'latin1'), readLabel, onAppArmor: onState,
            }, use),
        }, (line: string) => { test.info().annotations.push({ type: 'syn-arm', description: line }); });
        allDone = r.allDone;
      } finally {
        await proxy.close();
      }
    } finally {
      dummyAbsent = await dummy.close();
    }
    if (!dummyAbsent) throw new Error('SYN_E_DUMMY_PRESENT');
    if (!allDone) throw new Error('SYN_E_ARM');
  });
});
