// ABOUTME: Scratch Playwright config for NETWORK-STUBBED layout specs: no globalSetup, no storageState, no
// ABOUTME: webServer, no credentials. Every request leaving the page is intercepted by the spec; nothing reaches
// ABOUTME: Supabase or any other host. Serve a build first (e.g. `npx vite preview --port 4173 --strictPort`).
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/stubbed',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.STUBBED_BASE_URL || 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    // The CI/dev image preinstalls one Chromium at this path; a differently pinned @playwright/test would otherwise
    // look for its own build. Override only when the path exists, so the spec also runs where Playwright installed
    // its own browser.
    launchOptions: existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
  },
});
