import { test as base, expect } from '@playwright/test';
import type { ConsoleMessage, Response } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Audit mode (`E2E_AUDIT_CONSOLE=1`) records EVERY console error and EVERY
 * failed network response — including the ones the ignore lists below suppress —
 * to test-results/console-audit.jsonl.
 *
 * The ignore lists have grown two rules that between them hide most of what this
 * fixture exists to catch: `/\/rest\/v1\//` suppresses every PostgREST failure,
 * and `/^\[[A-Z][A-Za-z0-9]+\] \[\d{2}:\d{2}:\d{2}/` suppresses 110 of the app's
 * 187 logger prefixes. Two real page-breaking 42703 errors
 * (/courses/:id/quiz-results and /courses/:id/progress) were invisible to the
 * whole suite because of the first one.
 *
 * Deleting those rules outright would bury the real defects under noise from the
 * nine placeholder fixture IDs in helpers/route-helpers.ts, which is what the
 * rules were compensating for. So: record first, tighten once the fixtures are
 * real. Audit mode never changes pass/fail.
 */
const AUDIT = process.env.E2E_AUDIT_CONSOLE === '1';
// Deliberately NOT under test-results/ — Playwright wipes that directory at the
// start of every run, taking the log with it.
const AUDIT_FILE =
  process.env.E2E_AUDIT_FILE ?? path.join(process.cwd(), '.e2e-audit', 'console-audit.jsonl');

function auditRecord(entry: Record<string, unknown>): void {
  if (!AUDIT) return;
  try {
    fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
    fs.appendFileSync(AUDIT_FILE, `${JSON.stringify(entry)}\n`);
  } catch {
    // Recording is diagnostic only — never let it affect a test result.
  }
}

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
  // Lovable's editor script, loaded from a CDN by index.html:26. Third-party and
  // unrelated to any app behaviour — it fails CORS wherever that CDN is
  // unreachable, which is not a regression in this codebase.
  /cdn\.gpteng\.co/,
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
  // Third-party analytics / tracking (not our code). Anchored to real vendors —
  // a bare /analytics/i also swallowed the app's own [CourseAnalytics],
  // [StudentInsights] and analytics-query errors.
  /gtag/,
  /google-analytics\.com/,
  /googletagmanager\.com/,
  /segment\.(io|com)/,
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
  // (ThreadDetail / useForums patterns removed with the forum feature — the
  // routes redirect to /dashboard and the modules are deleted, so those
  // suppressions could only have hidden errors from live code.)
  // Mock interview room error (no session ID provided in URL)
  /\[MockInterviewRoom\]/,
  // Course permission and data errors for invalid-UUID tests
  /Invalid course UUID/,
  /\[CourseDetail\]/,
  /\[useCourseData\]/,
  /\[useCoursePermissions\]/,
  /\[useCourseProgress\]/,
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
  // useUserProfile transient RLS/no-row errors when profile row is missing
  // for a freshly-signed-in test user (Firefox seeds slower than Chromium).
  /\[useUserProfile\]/,

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
  // i.pravatar.cc — free third-party avatar host used for the landing page's
  // testimonial portraits (CommunityShowcase). It rate-limits and 503s under a
  // long suite, which failed landing and survey specs for a reason that has
  // nothing to do with this app. The Avatar falls back to initials, so a failed
  // image is a cosmetic third-party outage, not a regression.
  /i\.pravatar\.cc/,
  // cdn.gpteng.co — Lovable's editor script, loaded by index.html:26.
  //
  // This host is also listed in IGNORED_PATTERNS above, but that list is matched
  // against msg.text(), and the message this actually produces is the browser's
  // generic "Failed to load resource: net::ERR_CONNECTION_RESET" — the host
  // appears only in msg.location().url. So the existing rule never fired for the
  // common case, and 36 specs failed on a third-party script that the fixture
  // already intended to ignore. Suppression rules have to live in the list that
  // matches the shape of the message they are meant to catch.
  /cdn\.gpteng\.co/,
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
      const errors: ConsoleMessage[] = [];
      const where = { spec: testInfo.titlePath[0], test: testInfo.title, project: testInfo.project.name };

      // Capture console.error() calls
      const onConsole = (msg: ConsoleMessage) => {
        if (msg.type() !== 'error') return;
        const ignored = shouldIgnore(msg);
        auditRecord({
          ...where,
          kind: 'console',
          ignored,
          text: msg.text().slice(0, 500),
          url: msg.location()?.url ?? '',
        });
        if (!ignored) errors.push(msg);
      };

      // Capture uncaught exceptions (window.onerror / unhandledrejection)
      const onPageError = (err: Error) => {
        const fakeMsg = {
          type: () => 'error',
          text: () => `[pageerror] ${err.message}`,
          location: () => ({ url: '', lineNumber: 0, columnNumber: 0 }),
        } as unknown as ConsoleMessage;
        const ignored = shouldIgnore(fakeMsg);
        auditRecord({ ...where, kind: 'pageerror', ignored, text: fakeMsg.text().slice(0, 500), url: '' });
        if (!ignored) errors.push(fakeMsg);
      };

      // Audit only: every non-2xx response. A console message is not emitted for
      // a failed fetch/XHR the app handles itself, so PostgREST errors that the
      // app swallows are invisible to the listeners above — those are exactly
      // the ones worth cataloguing.
      const onResponse = (res: Response) => {
        if (!AUDIT || res.status() < 400) return;
        auditRecord({
          ...where,
          kind: 'response',
          ignored: null,
          status: res.status(),
          method: res.request().method(),
          url: res.url().slice(0, 400),
        });
      };

      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      if (AUDIT) page.on('response', onResponse);

      await use(errors);

      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      if (AUDIT) page.off('response', onResponse);

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
