// ABOUTME: Scratch Playwright config for the lesson-editor acceptance spec ONLY: no globalSetup/teardown, no webServer,
// ABOUTME: chromium only, one worker, traces off, signed in per test from the fixture's own 0600 storage states (run.sh setup).
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
    // Failure traces, videos and automatic screenshots are OFF: a trace would capture request headers (persona JWTs) and
    // storage. Screens are captured explicitly with labels; failures are diagnosed from the labelled JSON only.
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    serviceWorkers: 'block',
    // Bounded waits: an action or navigation that cannot complete fails at its own step instead of using the whole test
    // timeout (run 41691596496 spent the full 120 s with no step boundary to report).
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'lesson-editor-chromium',
      // Egress layer 1, the repository's shared hermetic resolver rule plus EXCLUDE 127.0.0.1 (see egress-boundary.ts).
      // Layers 2-4 (allowlist proxy, route/WebSocket filter, observation) are wired in by egress-test.ts.
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { ...chromiumExecutableOption(), args: ['--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost,EXCLUDE 127.0.0.1'] },
      },
    },
  ],
});
