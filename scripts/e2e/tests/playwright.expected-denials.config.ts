// ABOUTME: Scratch config for the expected-denial fixture controls only (no globalSetup, no webServer, no network).
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: ['expected-denials.pw.ts'],
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { launchOptions: { executablePath: process.env.ED_CHROMIUM_PATH || undefined } },
});
