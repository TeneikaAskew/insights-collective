// ABOUTME: Playwright config for the SYNTHETIC lifecycle matrix ONLY (LOCAL candidate, unrun). No inheritance from the E1 config:
// ABOUTME: its top-level `use` closes every context-option default (DESIGN-r2.2 B), so the runner's defaults merge adds nothing.
//
// @playwright/test 1.59.1 fills every `_combinedContextOptions` key a newContext caller omits (lib/index.js L283-L288), including
// for contexts a test creates itself. So `use` below sets exactly the synthetic table and `contextOptions: {}`, and sets no proxy,
// storageState, baseURL or other context option; baseURL's default source (PLAYWRIGHT_TEST_BASE_URL) is refused by the lane env
// check and by the spec at load. Traces, videos and screenshots are off. One worker, no retry. The project's launchOptions are
// the E1 incoming contract (pinned shell plus the resolver argument), checked unchanged by sandbox-launch.mjs.
import { defineConfig } from '@playwright/test';
import { chromiumExecutableOption } from '../support/chromium-executable';
import { RESOLVER_ARG } from './sandbox-launch.mjs';
import { SYN_TEST_TIMEOUT_MS, SYN_USE } from './lifecycle-matrix.mjs';

export default defineConfig({
  testDir: '.',
  testMatch: /lifecycle-matrix\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: SYN_TEST_TIMEOUT_MS,
  reporter: [['list'], ['json', { outputFile: process.env.LE_REPORT_JSON || 'test-results/lifecycle-matrix-report.json' }]],
  outputDir: process.env.LE_OUTPUT_DIR || 'test-results/lifecycle-matrix',
  use: { ...SYN_USE },
  projects: [
    {
      name: 'lifecycle-matrix-chromium',
      use: { launchOptions: { ...chromiumExecutableOption(), args: [RESOLVER_ARG] } },
    },
  ],
});
