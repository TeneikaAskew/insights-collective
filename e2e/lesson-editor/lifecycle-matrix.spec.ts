// ABOUTME: Lifecycle-matrix SYNTHETIC arm (LOCAL candidate, NOT RUN): ONE arm per lane container (LE_SYN_ARM), against that
// ABOUTME: container's own dummy page server and egress proxy, with its own sandboxed browser. Never E1 evidence or acceptance.
//
// Run only with playwright.lifecycle-matrix.config.ts inside the SYNTHETIC lane (LE_TARGET=SYNTHETIC). No app, API, Supabase,
// storage-state file, fixture write or credential exists in that lane. This file imports @playwright/test's BASE `test` (never
// egress-test.ts, whose auto `boundary` fixture would force a context), and its one test requests only the `playwright` and
// `launchOptions` fixtures: no page, context or browser fixture. The host runs arms A to D in sequence, one fresh container each
// (DESIGN-r3 section 1), so this test runs exactly the arm the container was created for. Two annotations carry the closed
// `syn-arm` and `syn-cleanup` bodies; the lane supervisor re-validates them, and the HOST derives every verdict.
// Refused at LOAD: any authentic target variable or Playwright's baseURL default source (DESIGN-r2.2 B), and any arm outside A-D.
for (const k of ['LE_APP_ORIGIN', 'LE_API_ORIGIN', 'LE_DB_URL', 'LE_DB_PASSWORD_FILE', 'LE_KEYS_DIR', 'LE_PROOF_FILE', 'LE_SOCK_DIR',
  'PLAYWRIGHT_TEST_BASE_URL', 'LE_ALLOWED_ORIGINS', 'LE_EGRESS_CONTROL']) {
  if (k in process.env) throw new Error(`lifecycle matrix refused: ${k} is set`);
}
if (process.env.LE_TARGET !== 'SYNTHETIC') throw new Error('lifecycle matrix refused: LE_TARGET is not SYNTHETIC');
if (!['A', 'B', 'C', 'D'].includes(process.env.LE_SYN_ARM ?? '')) throw new Error('lifecycle matrix refused: LE_SYN_ARM');
import { test } from '@playwright/test';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { allowedOrigins, installBoundary } from './egress-boundary';
import { startEgressProxy } from './egress-proxy';
import { readLabelAttempts, withSandboxedBrowser } from './sandbox-launch.mjs';
import { SYN_TEST_TIMEOUT_MS, runContainerArm, startDummyServer } from './lifecycle-matrix.mjs';

const readLabel = (who: number | 'self', note?: (outcomes: string[]) => void) => readLabelAttempts((p: string) => readFileSync(p, 'utf8'), who, note);

test.describe('lifecycle matrix (synthetic)', () => {
  test('one arm', async ({ playwright, launchOptions }) => {
    test.setTimeout(SYN_TEST_TIMEOUT_MS);
    const arm = process.env.LE_SYN_ARM ?? '';
    const shell = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '';
    const outputDir = process.env.LE_OUTPUT_DIR ?? '';
    if (!shell || !outputDir) throw new Error('LANE_E_SANDBOX_OPTION');
    const defaults = (playwright as unknown as { _defaultLaunchOptions?: Record<string, unknown> })._defaultLaunchOptions;
    // Per container: its own dummy server and its own egress proxy, whose upstream set is exactly the dummy's origin pair.
    const r = await runContainerArm(arm, {
      startDummy: () => startDummyServer(http),
      allowedOrigins,
      startProxy: (allowed: Set<string>) => startEgressProxy(allowed),
      installBoundary,
      withBrowser: (proxyUrl: string) => (onState: (s: unknown) => void, use: (browser: import('@playwright/test').Browser) => Promise<unknown>) =>
        withSandboxedBrowser(playwright.chromium, {
          launchOptions: launchOptions as Record<string, unknown>, defaults, shell, outputDir, proxyUrl,
          readCmdline: (pid: number) => readFileSync(`/proc/${pid}/cmdline`, 'latin1'), readLabel, onAppArmor: onState,
        }, use),
    });
    if (r.armLine) test.info().annotations.push({ type: 'syn-arm', description: r.armLine });
    if (r.cleanupLine) test.info().annotations.push({ type: 'syn-cleanup', description: r.cleanupLine });
    if (r.primary) throw new Error(r.primary);
    if (!r.done) throw new Error('SYN_E_ARM');
  });
});
