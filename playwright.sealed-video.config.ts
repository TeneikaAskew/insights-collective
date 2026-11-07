// ABOUTME: The ONE config for the sealed stubbed video lane (DESIGN r2 section 5, ADDENDUM r2.1 C3/C4). It runs only inside the
// ABOUTME: lane container (video-entry.mjs); it refuses at LOAD unless the exact lane environment and the pinned shell are present.
//
// No globalSetup, globalTeardown or webServer; no storageState; trace, video and screenshot off; service workers blocked.
// testDir resolves to <repo>/e2e/stubbed and testMatch selects exactly wp09a-video-embed.spec.ts (24 browser tests).
// The browser comes from e2e/stubbed/sandboxed-test.ts (Chromium sandbox ON via sandbox-launch.mjs). This file never imports
// e2e/support/chromium-executable, so loading it runs no browser binary. The one list-only mode (VIDEO_SEALED_LIST_ONLY=1 with
// --list) exists for the collection control and refuses any lane key.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { SEALED_VIDEO_TEST_DIR, SEALED_VIDEO_TEST_MATCH, sealedVideoSettings } from './scripts/e2e/le-lane/video-config.mjs';

const REPO = path.dirname(fileURLToPath(import.meta.url));
const s = sealedVideoSettings({
  env: process.env, argv: process.argv, repo: REPO,
  isFile: (p: string) => { try { return fs.statSync(p).isFile(); } catch { return false; } },
});
// The spec's own-config guard (defence in depth only). Set after validation, so a preset value was already refused.
if (s.mode === 'lane') process.env.PUBLIC_VIDEO_SEALED = '1';

export default defineConfig({
  testDir: `./${SEALED_VIDEO_TEST_DIR}`,
  testMatch: SEALED_VIDEO_TEST_MATCH,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  reporter: s.reportJson ? [['json', { outputFile: s.reportJson }]] : [['list']],
  outputDir: s.outputDir,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    serviceWorkers: 'block',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'sealed-video-chromium', use: { ...devices['Desktop Chrome'], launchOptions: s.launchOptions } },
  ],
});
