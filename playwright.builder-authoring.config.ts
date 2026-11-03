// ABOUTME: Playwright config for the builder-authoring acceptance lane ONLY (UNRUN). Strict local binding is asserted when
// ABOUTME: this file loads, before any setup. No base globalSetup/teardown, no webServer; the app is served by the job.
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutableOption } from './e2e/support/chromium-executable';
import { assertStrictLocalBinding } from './e2e/gradebook-roles/local-binding.mjs';

const { app } = assertStrictLocalBinding();
const DIR = process.env.BA_SESSION_DIR ?? '';
const RUN = process.env.BA_RUN_DIR ?? '';
if (!path.isAbsolute(DIR)) throw new Error('builder-authoring refused: BA_SESSION_DIR must be an absolute private dir');
if (!path.isAbsolute(RUN)) throw new Error('builder-authoring refused: BA_RUN_DIR must be an absolute private dir');
if (!/^[0-9a-f]{16}$/.test(process.env.BA_NONCE ?? '')) throw new Error('builder-authoring refused: BA_NONCE must be 16 hex');

const base = {
  ...devices['Desktop Chrome'], baseURL: app.origin, launchOptions: chromiumExecutableOption(),
  screenshot: 'off' as const, trace: 'off' as const, video: 'off' as const, serviceWorkers: 'block' as const,
  storageState: path.join(DIR, 'instructor.json'),
};
// Exactly these three projects, in this order (the launch-binding lane pins the list). D1/D2 act on one-shot rows and run in
// ba-1440 only; in ba-768 and ba-390 they are intentional skips, so the inventory is 18 entries = 14 executions + 4 skips
// (R1S, the separately labelled synchronized-input candidate of R1, runs where R1 runs).
export default defineConfig({
  testDir: './e2e/builder-authoring',
  testMatch: ['reorder.spec.ts', 'create.spec.ts', 'delete.spec.ts'],
  globalSetup: './e2e/builder-authoring/session-setup.ts',
  fullyParallel: false,
  retries: 0, // a retry would act on the first attempt's writes
  workers: 1,
  timeout: 90_000,
  reporter: [['json', { outputFile: path.join(RUN, 'report.json') }]],
  projects: [
    { name: 'ba-1440', use: { ...base, viewport: { width: 1440, height: 900 } } },
    { name: 'ba-768', dependencies: ['ba-1440'], use: { ...base, viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'ba-390', dependencies: ['ba-768'], use: { ...base, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
