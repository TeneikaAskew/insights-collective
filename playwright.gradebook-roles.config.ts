// ABOUTME: Scratch Playwright config for the gradebook real-role run ONLY. Strict local binding is asserted when this file
// ABOUTME: loads, before any setup. It does NOT inherit the base config's globalSetup/globalTeardown (which sweep and delete
// ABOUTME: rows and bootstrap passwords) nor its webServer: the app must already be served on E2E_BASE_URL (run.sh / job).
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutableOption } from './e2e/support/chromium-executable';
import { assertStrictLocalBinding } from './e2e/gradebook-roles/local-binding.mjs';

const { app } = assertStrictLocalBinding();          // throws before Playwright runs any setup
const SESSIONS = path.join(process.cwd(), '.playwright-sessions', 'gradebook-roles');
const chromium = { ...devices['Desktop Chrome'], baseURL: app.origin, launchOptions: chromiumExecutableOption(), screenshot: 'off' as const, trace: 'off' as const };

export default defineConfig({
  testDir: './e2e/gradebook-roles',
  globalSetup: './e2e/gradebook-roles/session-setup.ts',
  // no globalTeardown, no webServer: nothing outside the fixture is touched
  fullyParallel: false,
  retries: 0,               // a retry would grade on top of the first attempt
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-gradebook-roles' }]],
  projects: [
    { name: 'gb-instructor', use: { ...chromium, storageState: path.join(SESSIONS, 'instructor.json') }, testMatch: ['instructor-writers.spec.ts'] },
    { name: 'gb-learner', dependencies: ['gb-instructor'], use: { ...chromium, storageState: path.join(SESSIONS, 'member.json') }, testMatch: ['learner-view.spec.ts'] },
  ],
});
