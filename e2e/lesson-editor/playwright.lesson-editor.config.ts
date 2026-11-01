// ABOUTME: Scratch Playwright config for the lesson-editor acceptance spec ONLY: no globalSetup/teardown, no webServer,
// ABOUTME: chromium only, one worker, signed in per test from the fixture's own 0600 storage states (run.sh setup).
//
// The app must already be served (the T-09 job's `vite preview` on a loopback origin) and pointed at the isolated local
// stack. Required env (checked by the spec before any navigation): LE_APP_ORIGIN, LE_API_ORIGIN, LE_DB_URL, LE_WORK_DIR,
// E2E_EVIDENCE_COMMIT, E2E_EVIDENCE_ENVIRONMENT. Nothing here signs in with shared E2E accounts or touches their data.
import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutableOption } from '../support/chromium-executable';

export default defineConfig({
  testDir: '.',
  testMatch: /lesson-editor\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0, // a retry would mask a race; every failure is reported as it happened
  forbidOnly: true,
  timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: process.env.LE_REPORT_JSON || 'test-results/lesson-editor-report.json' }]],
  outputDir: process.env.LE_OUTPUT_DIR || 'test-results/lesson-editor',
  use: {
    baseURL: process.env.LE_APP_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'off', // screens are captured explicitly with labels
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'lesson-editor-chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { ...chromiumExecutableOption() } },
    },
  ],
});
