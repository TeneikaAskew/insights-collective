// ABOUTME: Playwright config for the builder-authoring acceptance lane ONLY (UNRUN). Strict local binding is asserted when
// ABOUTME: this file loads, before any setup. No base globalSetup/teardown, no webServer; the app is served by the job.
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutableOption } from './e2e/support/chromium-executable';
import { assertStrictLocalBinding } from './e2e/gradebook-roles/local-binding.mjs';

const { app } = assertStrictLocalBinding();
const DIR = process.env.BA_SESSION_DIR ?? '';
if (!path.isAbsolute(DIR)) throw new Error('builder-authoring refused: BA_SESSION_DIR must be an absolute private dir');
if (!path.isAbsolute(process.env.BA_RUN_DIR ?? '')) throw new Error('builder-authoring refused: BA_RUN_DIR must be an absolute private dir');
if (!/^[a-z0-9]{8,32}$/.test(process.env.BA_NONCE ?? '')) throw new Error('builder-authoring refused: BA_NONCE must be 8-32 [a-z0-9]');

const base = {
  ...devices['Desktop Chrome'], baseURL: app.origin, launchOptions: chromiumExecutableOption(),
  screenshot: 'off' as const, trace: 'off' as const, serviceWorkers: 'block' as const,
  storageState: path.join(DIR, 'instructor.json'),
};
// Three widths. The one-shot delete controls run only in ba-1440 (their rows exist once); reorder and create run in all.
export default defineConfig({
  testDir: './e2e/builder-authoring',
  globalSetup: './e2e/builder-authoring/session-setup.ts',
  fullyParallel: false,
  retries: 0, // a retry would act on the first attempt's writes
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: path.join(process.env.BA_RUN_DIR ?? '', 'report.json') }]],
  projects: [
    { name: 'ba-1440', use: { ...base, viewport: { width: 1440, height: 900 } } },
    { name: 'ba-768', dependencies: ['ba-1440'], use: { ...base, viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'ba-390', dependencies: ['ba-768'], use: { ...base, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
