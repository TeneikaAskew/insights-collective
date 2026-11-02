// ABOUTME: Scratch Playwright config for the T-15 Students/Reports persona acceptance ONLY (UNRUN). Strict local binding is
// ABOUTME: asserted at load; no base globalSetup/teardown (no sweeps or deletes) and no webServer (the job serves the app).
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutableOption } from './e2e/support/chromium-executable';
import { assertStrictLocalBinding } from './e2e/gradebook-roles/local-binding.mjs';

const { app } = assertStrictLocalBinding();
const DIR = process.env.RR_SESSION_DIR ?? '';
if (!path.isAbsolute(DIR)) throw new Error('roster-reports refused: RR_SESSION_DIR must be an absolute private directory');
const state = (role: 'admin' | 'instructor' | 'member') => path.join(DIR, `${role}.json`);
const chromium = { ...devices['Desktop Chrome'], baseURL: app.origin, launchOptions: chromiumExecutableOption(), screenshot: 'off' as const, trace: 'off' as const, serviceWorkers: 'block' as const };

const projects = [
  { name: 'rr-instructor', use: { ...chromium, storageState: state('instructor') }, testMatch: ['instructor.spec.ts', 'mobile-keyboard.spec.ts'] },
  { name: 'rr-admin', use: { ...chromium, storageState: state('admin') }, testMatch: ['admin.spec.ts'] },
  { name: 'rr-learner', use: { ...chromium, storageState: state('member') }, testMatch: ['learner.spec.ts'] },
];
// PENDING technique: per-test request injection. Never part of a default run.
if (process.env.RR_ERROR_INJECTION === '1') {
  projects.push({ name: 'rr-error-pending', use: { ...chromium, storageState: state('instructor') }, testMatch: ['error.pending.ts'] });
}

export default defineConfig({
  testDir: './e2e/roster-reports',
  globalSetup: './e2e/roster-reports/session-setup.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-roster-reports' }]],
  projects,
});
