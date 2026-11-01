// ABOUTME: Playwright config for the learner quiz lifecycle mode ONLY. No globalSetup, no globalTeardown, no webServer,
// ABOUTME: no stored sessions, no traces/videos: the job's preflight proves the preview is this build before this runs.
//
// Why not playwright.config.ts: its global-setup bootstraps passwords through an admin function, sweeps courses and
// deletes the member's quiz attempts, and its teardown cleans shared rows. None of that is purpose-scoped to this mode,
// so none of it may run here. Sign-in is per test, in memory (e2e/quiz-lifecycle/session.fixture.ts).
//
// Specs are *.isolated.ts so the default config (testMatch *.spec.ts / *.test.ts) never picks them up.
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutableOption } from './e2e/support/chromium-executable';

const BASE_URL = process.env.E2E_BASE_URL;
if (!BASE_URL) throw new Error('quiz-lifecycle config: E2E_BASE_URL is required (the preflight-checked preview)');
const host = new URL(BASE_URL).hostname;
if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error('quiz-lifecycle config: E2E_BASE_URL must be loopback');
if (process.env.E2E_USE_RELAY) throw new Error('quiz-lifecycle config: relay mode is not allowed');

// The job sets a job-scoped QLC_EVIDENCE_DIR; the fallback stays outside the repository.
const OUT = process.env.QLC_EVIDENCE_DIR || path.join(os.tmpdir(), 'qlc-evidence');

export default defineConfig({
  testDir: './e2e/quiz-lifecycle',
  testMatch: ['**/*.isolated.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0, // a retry would consume another attempt and could hide an ordering defect
  forbidOnly: true,
  timeout: 120_000,
  outputDir: `${OUT}/playwright-output`,
  reporter: [['list'], ['json', { outputFile: `${OUT}/playwright/results.json` }]],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'off', // evidence screenshots are taken explicitly, per scenario and viewport
    ...devices['Desktop Chrome'],
    launchOptions: { ...chromiumExecutableOption() },
  },
  projects: [{ name: 'chromium-quiz-lifecycle' }],
});
