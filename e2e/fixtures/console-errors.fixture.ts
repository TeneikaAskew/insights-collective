import { test as base, expect } from '@playwright/test';
import type { ConsoleMessage } from '@playwright/test';

/**
 * Known-noisy messages that are safe to ignore.
 * These come from third-party scripts, browser extensions, or React
 * internals that fire in every environment and are not our bugs.
 */
const IGNORED_PATTERNS: RegExp[] = [
  // Browser / OS noise
  /ResizeObserver loop limit exceeded/,
  /ResizeObserver loop completed with undelivered notifications/,
  /Non-Error promise rejection captured/,
  // React DevTools (only present when extension is installed)
  /Download the React DevTools/,
  // Lovable component tagger (dev-only, not our code)
  /lovable-tagger/,
  // Supabase realtime warning when no channel is subscribed
  /No session found/,
  // Vite HMR noise in test environments
  /\[vite\]/,
  // Network request cancelled when navigating away mid-fetch
  /Failed to fetch/,
  /NetworkError/,
  /net::ERR_ABORTED/,
  /net::ERR_FAILED/,
  /net::ERR_NETWORK_CHANGED/,
  // React 18 concurrent mode warnings that aren't actionable in tests
  /Warning: An update to .* inside a test was not wrapped in act/,
  // Monaco editor workers (loaded via CDN, may fail in offline environments)
  /monaco.*worker/i,
  // Third-party analytics / tracking (not our code)
  /gtag/,
  /analytics/i,
];

function shouldIgnore(msg: ConsoleMessage): boolean {
  const text = msg.text();
  return IGNORED_PATTERNS.some((pattern) => pattern.test(text));
}

interface ConsoleFixtures {
  /**
   * Automatically collected console errors for the current test.
   * The fixture asserts this array is empty after each test completes.
   * Tests can inspect it mid-test if needed.
   */
  consoleErrors: ConsoleMessage[];
}

/**
 * Base test extended with automatic console-error detection.
 *
 * Every test that uses this base (directly or via a re-export) will:
 *   1. Listen for `console.error` and uncaught page errors during the test.
 *   2. Fail the test if any non-ignored errors were emitted.
 *
 * Usage: import { test, expect } from '../fixtures/console-errors.fixture'
 * (or from any fixture file that re-exports this test)
 */
export const test = base.extend<ConsoleFixtures>({
  consoleErrors: [
    async ({ page }, use, testInfo) => {
      const errors: ConsoleMessage[] = [];

      // Capture console.error() calls
      const onConsole = (msg: ConsoleMessage) => {
        if (msg.type() === 'error' && !shouldIgnore(msg)) {
          errors.push(msg);
        }
      };

      // Capture uncaught exceptions (window.onerror / unhandledrejection)
      const onPageError = (err: Error) => {
        const fakeMsg = {
          type: () => 'error',
          text: () => `[pageerror] ${err.message}`,
          location: () => ({ url: '', lineNumber: 0, columnNumber: 0 }),
        } as unknown as ConsoleMessage;
        if (!shouldIgnore(fakeMsg)) {
          errors.push(fakeMsg);
        }
      };

      page.on('console', onConsole);
      page.on('pageerror', onPageError);

      await use(errors);

      page.off('console', onConsole);
      page.off('pageerror', onPageError);

      // Assert after the test body runs
      if (errors.length > 0) {
        const messages = errors
          .map((e) => `  • ${e.text()}`)
          .join('\n');
        expect(
          errors,
          `Test "${testInfo.title}" produced ${errors.length} console error(s):\n${messages}`,
        ).toHaveLength(0);
      }
    },
    { auto: true }, // <-- attach to EVERY test automatically, no opt-in needed
  ],
});

export { expect } from '@playwright/test';
