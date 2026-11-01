// ABOUTME: Scratch config for the egress-boundary self-test only (no stack, loopback test servers). Same browser settings as the
// ABOUTME: lesson-editor config: shared hermetic resolver rule, service workers blocked, traces off.
import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutableOption } from '../support/chromium-executable';

export default defineConfig({
  testDir: '.',
  testMatch: /egress-selftest\.spec\.ts$/,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  outputDir: process.env.LE_OUTPUT_DIR || 'test-results/lesson-editor-egress',
  use: { trace: 'off', screenshot: 'off', video: 'off', serviceWorkers: 'block' },
  projects: [
    {
      name: 'egress-selftest-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { ...chromiumExecutableOption(), args: ['--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost,EXCLUDE 127.0.0.1'] },
      },
    },
  ],
});
