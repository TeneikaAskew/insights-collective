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
// the browser launches; the matching `.end` is written at worker teardown (after the observer has stopped counting), also
// after a launch failure. Both wx 0600, never overwritten. The supervisor aggregates them after Playwright exits.
// Writers (disclosed; this file is a NEW write site for the security.yml fs-write gate, which needs a specific reviewed
// exception before publication): exactly those two files per worker, under LE_EGRESS_DIR only.
import { test as base, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { postrunAppArmor, withSandboxedBrowser } from '../lesson-editor/sandbox-launch.mjs';
import { readLabel } from '../lesson-editor/egress-test';
import { egressEndText, egressStem, refusedLine, START_TEXT } from '../../scripts/e2e/le-lane/egress-records.mjs';

type AppArmorState = Parameters<typeof postrunAppArmor>[0];
type Ledger = { refused: number; tests: number; lines: string[]; note: (reason: 'method' | 'websocket', method: string, url: string) => void };

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
      const ledger: Ledger = {
        refused: 0, tests: 0, lines: [],
        note(reason, method, url) { this.refused++; if (this.lines.length < 16) this.lines.push(refusedLine(reason, method, url)); },
      };
      writeFileSync(path.join(egressDir, `${stem}.start`), START_TEXT, { flag: 'wx', mode: 0o600 });
      try { await use(ledger); } finally {
        writeFileSync(path.join(egressDir, `${stem}.end`),
          egressEndText({ refused: ledger.refused, forwarded: 0, tests: ledger.tests, closed: true, lines: ledger.lines }), { flag: 'wx', mode: 0o600 });
      }
    },
    { scope: 'worker' },
  ],
  // The worker browser: sandbox ON (chromiumSandbox: true, written last), the closed incoming and EFFECTIVE option contract,
  // the owned-browser argv attestation, the AppArmor pre-gate, and awaited bounded cleanup (sandbox-launch.mjs, unchanged).
  // No proxy (proxyUrl null). No launch()/launchPersistentContext fallback and no retry without the sandbox.
  browser: [
    async ({ playwright, launchOptions, egressLedger }, use) => {
      void egressLedger; // dependency only: the .start record exists before this launch
      const { shell, outputDir } = laneValues();
      const defaults = (playwright as unknown as { _defaultLaunchOptions?: Record<string, unknown> })._defaultLaunchOptions;
      await withSandboxedBrowser(playwright.chromium, {
        launchOptions: launchOptions as Record<string, unknown>, defaults, shell, outputDir, proxyUrl: null,
        readCmdline: (pid: number) => readFileSync(`/proc/${pid}/cmdline`, 'latin1'),
        readLabel, onAppArmor: (s: AppArmorState) => { laneAppArmor = s; },
      }, use);
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
  // Independent detection on the test's context: every page (popups included) is observed from its creation.
  observer: [
    async ({ context, egressLedger }, use) => {
      egressLedger.tests++;
      const seen: string[] = [];
      const onRequest = (r: { method(): string; url(): string }) => {
        const m = r.method();
        if (m !== 'GET' && m !== 'HEAD') { egressLedger.note('method', m, r.url()); seen.push(refusedLine('method', m, r.url())); }
      };
      const onWs = (ws: { url(): string }) => { egressLedger.note('websocket', '', ws.url()); seen.push(refusedLine('websocket', '', ws.url())); };
      const watch = (p: { on(e: 'websocket', f: typeof onWs): unknown }) => { p.on('websocket', onWs); };
      context.on('request', onRequest);
      context.on('page', watch);
      for (const p of context.pages()) watch(p);
      try { await use(); } finally {
        context.off('request', onRequest);
        context.off('page', watch);
        for (const p of context.pages()) p.off('websocket', onWs);
      }
      test.info().annotations.push({ type: 'egress', description: JSON.stringify({ observed: seen }) });
      expect(seen, 'observer: non-GET/HEAD requests or WebSockets').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
