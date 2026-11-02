// ABOUTME: Runs ONLY the readiness self-test against its loopback stand-in (readiness-selftest.sh). Headless shell, no
// ABOUTME: proxy, nothing but the loopback stand-in is addressed. MOCKED tier: not a stack, not acceptance.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['readiness.selftest.ts'],
  reporter: [['list']],
  workers: 1,
  outputDir: `${process.env.QLC_READINESS_OUT}/readiness-selftest-output`,
  use: {
    headless: true, trace: 'off', screenshot: 'off', video: 'off', serviceWorkers: 'block',
    // Optional local override when the installed browser revision differs from the pinned Playwright's (stated in receipts).
    launchOptions: process.env.QLC_CHROMIUM_EXECUTABLE ? { executablePath: process.env.QLC_CHROMIUM_EXECUTABLE } : {},
  },
});
