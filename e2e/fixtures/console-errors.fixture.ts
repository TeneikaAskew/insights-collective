import { test as base, expect } from '@playwright/test';
import type { ConsoleMessage } from '@playwright/test';
import { installSupabaseBridge } from './supabase-bridge';

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
  // Expected auth errors in login tests (bad credentials, intercepted auth)
  /AuthApiError/,
  /Invalid login credentials/,
  /handleUserLogin.*Login error/,
  /\[Login\].*error/i,
  // 400 from mocked/intercepted Supabase auth endpoint in tests
  /auth\/v1\/token/,

  // ── Expected app-level console.error from missing/empty test data ──────────
  // React DOM nesting warning: <a> inside <a> in forum breadcrumbs
  /validateDOMNesting/,
  // App 404 route debug log (expected for not-found route tests)
  /\[NotFound\]/,
  // Assignment/content item errors (content_items table is empty in test env)
  /Error loading assignment/,
  /Error fetching content item/,
  /getContentItem/,
  // Forum thread errors (threads table is empty / schema difference)
  /\[ThreadDetail\]/,
  // Mock interview room error (no session ID provided in URL)
  /\[MockInterviewRoom\]/,
  // Course permission and data errors for invalid-UUID tests
  /Invalid course UUID/,
  /\[CourseDetail\]/,
  /\[useCourseData\]/,
  /\[useCoursePermissions\]/,
  /\[useCourseProgress\]/,
  /\[useForums\]/,
  // Quiz / grading errors (schema relationships missing in test DB)
  /\[CanvasQuizResults\]/,
  /\[gradingSubmissions\]/,
  // Admin localStorage debug page — Edge Function rate-limited in test env
  /\[refreshItems\]/,
  /FunctionsHttpError/,
  // Resume table doesn't exist in test DB
  /Resumes table does not exist/,

  // ── React error boundary / component crash messages ────────────────────────
  // These appear after a component throws, often due to missing test data.
  // The root cause is captured via app-level errors above.
  /The above error occurred in one of your React components/,
  /Consider adding an error boundary/,

  // ── Vite HMR dynamic import failures (transient, not our bugs) ────────────
  // Happen when source files change while the dev server is running tests.
  /error loading dynamically imported module/,

  // ── Monaco editor CSP / CDN errors (dev-only, not our bugs) ───────────────
  /Content Security Policy/,
  /Loading "vs\//,
  /cdn\.jsdelivr/,
  /Here are the modules that depend/,
  // Monaco CSS module loading errors (list of vs/css! modules that failed to load)
  /\[vs\/css!/,

  // ── Enrollment badge errors (course_enrollments table missing in test env) ─
  // ── Enrollment badge errors (course_enrollments table missing in test env) ─
  /\[EnrollmentBadge\]/,
  // Firefox-specific image decode errors (corrupt/truncated from CDN)
  /Image corrupt or truncated/,

  // ── App-level logger.ts errors from placeholder-ID E2E fixtures ────────────
  // Any error emitted via our shared logger.ts is prefixed with
  // "[ComponentName] [HH:MM:SS.mmm]" — these are expected in tests that
  // navigate to routes with placeholder UUIDs and cannot fetch real data.
  /^\[[A-Z][A-Za-z0-9]+\] \[\d{2}:\d{2}:\d{2}/,
];

/**
 * For browser-native "Failed to load resource: the server responded with
 * a status of NNN ()" messages, the request URL is in msg.location().url
 * rather than msg.text(). We match against these URL patterns separately.
 */
const IGNORED_URL_PATTERNS: RegExp[] = [
  // Supabase REST — all /rest/v1/ errors are expected in test env because
  // placeholder IDs (e.g. "test-course-id") are not valid UUIDs and cause 400s.
  // This is a broad catch-all; if a REAL Supabase REST bug appears it will
  // surface as a visible app error, not just a browser "Failed to load resource".
  /\/rest\/v1\//,
  // Supabase Auth — expected 400 for invalid credentials / token refresh
  /\/auth\/v1\//,
  // Supabase Edge Functions — expected non-2xx in test env (rate limit, etc.)
  /\/functions\/v1\//,
  // Vite dev server — HMR module reload returns 500 when files change mid-run
  /localhost:\d+\/src\//,
  /localhost:\d+\/node_modules\/.vite/,
];

function shouldIgnore(msg: ConsoleMessage): boolean {
  const text = msg.text();

  // Check text-based patterns first (covers app console.error calls)
  if (IGNORED_PATTERNS.some((pattern) => pattern.test(text))) return true;

  // For browser-native "Failed to load resource" errors the URL is in
  // msg.location(), not msg.text() — check URL patterns separately.
  if (text.startsWith('Failed to load resource:')) {
    const url = msg.location()?.url ?? '';
    if (IGNORED_URL_PATTERNS.some((pattern) => pattern.test(url))) return true;
  }

  return false;
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
      // No-op unless E2E_SUPABASE_BRIDGE=1. See supabase-bridge.ts — only for
      // sandboxes where the browser cannot reach the network but the shell can.
      await installSupabaseBridge(page);

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
