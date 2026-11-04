// ABOUTME: Playwright `test` for the sealed stubbed video lane: ONLY the worker `browser` is overridden (Chromium sandbox ON via
// ABOUTME: sandbox-launch.mjs), plus an AppArmor gate, a per-test request/WebSocket observer and a per-worker egress record.
//
// Stock and untouched: page, context, baseURL, page.clock, testInfo.outputPath and test.use (viewport, storageState).
// Layers, each claimed only for itself (DESIGN r2 section 5):
//   - prevention is the spec's own method-first decide() and WebSocket close (owner);
//   - this fixture is INDEPENDENT DETECTION: any request whose method is not GET or HEAD, and any WebSocket created, is
//     counted into the worker record AND fails the test (observer);
//   - the outer container (network none, one bridged port) is the third layer (run-lane / video-entry).
// The video kind has no egress proxy (DESIGN r2 section 3): `forwarded` is always 0 and refusals are observer events.
// Per-worker record (ADDENDUM r2.1 C2): `<LE_EGRESS_DIR>/w-<workerIndex>-<parallelIndex>-<pid>-<nonce>.start` is written BEFORE
// the browser launches; the matching `.end` is written at worker teardown, AFTER the owned browser and its server have closed
// (the browser fixture depends on the ledger), also after a launch failure. Both wx 0600, never overwritten. The supervisor
// aggregates them after Playwright exits. The detection logic (observer kept attached through context closure, `closed` only
// after a clean browser close, layout-only text-render precheck) is pure in scripts/e2e/le-lane/video-observer.mjs; the two
// writes stay HERE.
// Writers (disclosed; a NEW write site that the repository's security.yml fs-write gate reports; it is under writer review and
// the gate is unchanged): exactly those two files per worker, under LE_EGRESS_DIR only.
import { test as base, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { postrunAppArmor, withSandboxedBrowser } from '../lesson-editor/sandbox-launch.mjs';
import { readLabel } from '../lesson-editor/egress-test';
import { egressEndText, egressStem, START_TEXT } from '../../scripts/e2e/le-lane/egress-records.mjs';
import { createLedger, finalLedger, observeTest, runWorkerBrowser } from '../../scripts/e2e/le-lane/video-observer.mjs';

type AppArmorState = Parameters<typeof postrunAppArmor>[0];
type Ledger = ReturnType<typeof createLedger>;

let laneAppArmor: AppArmorState | null = null;

/** The lane values this fixture needs; the config already refused at load unless the whole lane environment is exact. */
function laneValues() {
  const shell = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '';
  const outputDir = process.env.LE_OUTPUT_DIR ?? '';
  const egressDir = process.env.LE_EGRESS_DIR ?? '';
  if (process.env.LE_KIND !== 'video' || process.env.PUBLIC_VIDEO_SEALED !== '1' || !path.isAbsolute(shell) || !path.isAbsolute(outputDir) || !path.isAbsolute(egressDir)) {
    throw new Error('LANE_E_SANDBOX_OPTION');
  }
  return { shell, outputDir, egressDir };
}

export const test = base.extend<{ laneAppArmorGate: void; observer: void }, { egressLedger: Ledger }>({
  // The worker ledger: the .start record before anything launches, the .end record at teardown on every path.
  egressLedger: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their (empty) dependencies
    async ({}, use, workerInfo) => {
      const { egressDir } = laneValues();
      const stem = egressStem({ workerIndex: workerInfo.workerIndex, parallelIndex: workerInfo.parallelIndex, pid: process.pid, nonce: randomBytes(8).toString('hex') });
      const ledger: Ledger = createLedger();
      writeFileSync(path.join(egressDir, `${stem}.start`), START_TEXT, { flag: 'wx', mode: 0o600 });
      try { await use(ledger); } finally {
        writeFileSync(path.join(egressDir, `${stem}.end`), egressEndText(finalLedger(ledger)), { flag: 'wx', mode: 0o600 });
      }
    },
    { scope: 'worker' },
  ],
  // The worker browser: sandbox ON (chromiumSandbox: true, written last), the closed incoming and EFFECTIVE option contract,
  // the owned-browser argv attestation, the AppArmor pre-gate, and awaited bounded cleanup (sandbox-launch.mjs, unchanged).
  // No proxy (proxyUrl null). No launch()/launchPersistentContext fallback and no retry without the sandbox.
  browser: [
    async ({ playwright, launchOptions, egressLedger }, use) => {
      // egressLedger is a dependency: the .start record exists before this launch, and the .end waits for this teardown.
      const { shell, outputDir } = laneValues();
      const defaults = (playwright as unknown as { _defaultLaunchOptions?: Record<string, unknown> })._defaultLaunchOptions;
      // The text-render precheck runs first on this browser; `closed` is set only if withSandboxedBrowser returns normally.
      await runWorkerBrowser((body: (b: unknown) => Promise<unknown>) => withSandboxedBrowser(playwright.chromium, {
        launchOptions: launchOptions as Record<string, unknown>, defaults, shell, outputDir, proxyUrl: null,
        readCmdline: (pid: number) => readFileSync(`/proc/${pid}/cmdline`, 'latin1'),
        readLabel, onAppArmor: (s: AppArmorState) => { laneAppArmor = s; },
      }, body), egressLedger, use);
    },
    { scope: 'worker' },
  ],
  // After each test the worker and owned-browser AppArmor labels must still equal the pre-launch ENFORCE codes; the fixed line
  // goes to the `lane-apparmor` annotation, which video-entry copies from the JSON report.
  laneAppArmorGate: [
    async ({ browser }, use) => {
      void browser;
      const state = laneAppArmor;
      if (!state) throw new Error('LANE_E_APPARMOR_PRE');
      await use();
      const post = postrunAppArmor(state);
      test.info().annotations.push({ type: 'lane-apparmor', description: post.line });
      if (!post.ok) throw new Error('LANE_E_APPARMOR_POST');
    },
    { auto: true },
  ],
  // Independent detection on the test's context: every page (popups included) is observed from its creation. The listeners are
  // NOT removed here: they stay attached through Playwright's own context teardown, and later events count in the worker ledger.
  observer: [
    async ({ context, egressLedger }, use) => {
      const seen = await observeTest(context, egressLedger, use);
      test.info().annotations.push({ type: 'egress', description: JSON.stringify({ observed: seen }) });
      expect(seen, 'observer: non-GET/HEAD requests or WebSockets').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
