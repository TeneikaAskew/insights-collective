import { test as base, expect } from '@playwright/test';
import type { ConsoleMessage, Response } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { SupabaseIssue } from '../../src/integrations/supabase/instrumentation';
import { structuralIssues, describeIssue } from '../../src/integrations/supabase/issue-triage';
import { redactUrl, redactText } from '../../src/integrations/supabase/redact-secrets';

/**
 * Two mechanisms live here, and the second is the one that matters.
 *
 * 1. Console errors, filtered through the ignore lists below. Those lists have
 *    grown two rules that between them hide most of what this fixture was
 *    supposed to catch: `/\/rest\/v1\//` suppresses every PostgREST failure, and
 *    `/^\[[A-Z][A-Za-z0-9]+\] \[\d{2}:\d{2}:\d{2}/` suppresses 110 of the app's
 *    187 logger prefixes. Two real page-breaking 42703 errors
 *    (/courses/:id/quiz-results and /courses/:id/progress) were invisible to the
 *    whole suite because of the first.
 *
 * 2. Structural Supabase failures, read from the app's own instrumentation
 *    (src/integrations/supabase/instrumentation.ts) rather than from console
 *    text. See structuralIssues() below.
 *
 * The obvious fix for (1) was to delete the two blanket rules. That trades one
 * blindness for another: they suppress a real volume of expected noise, and
 * without them the genuine defects drown. Matching on prose was the mistake —
 * a suppression pattern has to guess how a message was worded, and an error's
 * severity has nothing to do with which component logged it.
 *
 * (2) sidesteps that. A 42703 is a 42703 whoever logged it, and it can never be
 * confused with an empty table, so it needs no suppression list at all. The
 * console rules stay as a backstop for everything that is not a Supabase
 * request; they are no longer the only thing standing between a broken query
 * and a green suite.
 *
 * Audit mode (`E2E_AUDIT_CONSOLE=1`) records console errors and failed network
 * responses — including suppressed ones — to .e2e-audit/console-audit.jsonl.
 * It never changes pass/fail.
 *
 * Its coverage is bounded by where these listeners attach: the INJECTED `page`,
 * and nothing else. Specs that build their own page with
 * `browser.newContext().newPage()` — 43 call sites across 16 files, including
 * the visual suite, blog-post, the legal pages and the survey specs — are
 * invisible to it. Absence from the catalog therefore means "not watched",
 * NOT "clean". Widening this to cover every context is PR 7c's job; until then
 * the artifact is a partial census and has to be read as one.
 *
 * Recorded URLs and text pass through redact-secrets.ts first, because CI
 * publishes this file as a downloadable artifact.
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
 * Third-party hosts whose console noise is never our bug.
 */
const IGNORED_HOSTS = [
  // Lovable's editor script, loaded from a CDN by index.html:26. It fails CORS
  // wherever that CDN is unreachable, which is not a regression here.
  'cdn.gpteng.co',
  // Analytics / tracking vendors. Named explicitly because a bare /analytics/i
  // also swallowed the app's own [CourseAnalytics] and [StudentInsights] errors.
  'google-analytics.com',
  'googletagmanager.com',
  'segment.io',
  'segment.com',
];

/**
 * True when the message names one of IGNORED_HOSTS as an actual host.
 *
 * Deliberately not a regex, after two attempts that were both wrong.
 *
 * A bare /google-analytics\.com/ also matches `evil-google-analytics.com` and
 * `google-analytics.com.attacker.net`, so an error mentioning either was
 * silently suppressed — the same over-matching that made a bare /analytics/i
 * swallow the app's own errors. Rewriting it with lookarounds fixed the
 * semantics but CodeQL only recognizes `^`-style anchors, so the alert count
 * went up rather than down, and anchoring to `^` is simply wrong here: these
 * match anywhere inside a console message, not a whole URL.
 *
 * Host comparison is not a regex problem. Split the message on characters that
 * cannot appear in a hostname, then compare the candidates as hosts — exact
 * match or a proper subdomain. No anchors to get wrong, and the suffix check
 * makes `evil-google-analytics.com` and `google-analytics.com.attacker.net`
 * fail by construction.
 */
function mentionsIgnoredHost(text: string): boolean {
  return text
    .toLowerCase()
    .split(/[^a-z0-9.-]+/)
    .some((token) =>
      IGNORED_HOSTS.some((host) => token === host || token.endsWith(`.${host}`)),
    );
}

/**
 * Known-noisy messages that are safe to ignore.
 * These come from third-party scripts, browser extensions, or React
 * internals that fire in every environment and are not our bugs.
 */
type IgnoreRule = RegExp | ((text: string) => boolean);

const IGNORED_PATTERNS: IgnoreRule[] = [
  // Browser / OS noise
  /ResizeObserver loop limit exceeded/,
  /ResizeObserver loop completed with undelivered notifications/,
  /Non-Error promise rejection captured/,
  // React DevTools (only present when extension is installed)
  /Download the React DevTools/,
  // Lovable component tagger (dev-only, not our code)
  /lovable-tagger/,
  // Lovable's editor script, loaded from a CDN by index.html:26. Third-party and
  // unrelated to any app behavior — it fails CORS wherever that CDN is
  // unreachable, which is not a regression in this codebase.
  // Firefox reports a rejected third-party cookie as a page error against the
  // URL that tried to set it. Cloudflare sits in front of Supabase storage and
  // sets __cf_bm on avatar image responses; Firefox refuses it for the storage
  // host and logs this. Nothing in this codebase sets or reads that cookie, and
  // the image itself loads.
  //
  // It appeared when migration 20260802140000 widened can_view_profile: the
  // course list can now resolve the profiles of coursemates it previously could
  // not see, so it renders avatars that were never requested before. Three
  // firefox course-list tests went red on it. The trigger was a real change in
  // what the app fetches, but the message is a browser notice about a
  // third-party cookie, not an app failure.
  //
  // Anchored on the cookie name so it cannot generalise into "ignore cookie
  // problems": an app-set cookie being rejected would still fail the suite.
  /Cookie [“"]__cf_bm[”"] has been rejected/,
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
  // Third-party analytics / tracking (not our code). Named vendors only —
  // a bare /analytics/i also swallowed the app's own [CourseAnalytics],
  // [StudentInsights] and analytics-query errors — and matched as whole
  // hostnames, so a lookalike domain cannot inherit the suppression.
  /gtag/,
  // Vendor hosts are matched by mentionsIgnoredHost, not by pattern.
  mentionsIgnoredHost,
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

  // Realtime over the relay, and only over the relay. scripts/e2e/supabase-relay.mjs
  // is a plain HTTP relay — it strips hop-by-hop headers including `upgrade` and
  // never handles the upgrade event — so a websocket to the loopback port closes
  // before the handshake. Nothing in the app is wrong and no spec here tests
  // realtime; the subscriptions are an enhancement over data that loads by
  // fetch.
  //
  // Deliberately narrow: loopback host, the realtime path, and relay mode only.
  // A websocket failure against the real project, or against any other path,
  // still fails its test. This rule replaced no CSP suppression — the CSP block
  // that used to cause this same message was a real defect and is fixed in
  // SecurityHeaders.tsx.
  (text: string) =>
    RELAY_MODE &&
    /(WebSocket connection to|Connecting to) 'ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/realtime\/v1\/websocket/.test(
      text,
    ),

  // The Monaco block that lived here — /Content Security Policy/,
  // /Loading "vs\//, /cdn\.jsdelivr/, /Here are the modules that depend/ and
  // /\[vs\/css!/ — is gone with its subject. Monaco is bundled now and served
  // from this origin, so none of those messages can be emitted by a healthy
  // page; if one appears again it means the loader went back to the CDN, which
  // is precisely what a suppression must not hide. /Content Security Policy/
  // was the widest of them and would have swallowed any CSP violation anywhere
  // in the app — it hid a real one, the img-src block on loopback Supabase
  // storage, until Firefox reported it through a different code path.

  // EnrollmentBadge's suppression is GONE, along with the component: this PR
  // deletes src/components/course/EnrollmentBadge.tsx, so a rule matching
  // "[EnrollmentBadge]" can never fire again. A suppression outliving its
  // subject is not harmless — it is a standing permission to ignore a message
  // that, if it ever reappeared, would be coming from something else entirely.
  // (The duplicated comment line it replaced was also the only trace that this
  // entry had been added twice.)
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
];

/**
 * Hosts the browser is allowed to reach. Everything else is blocked on purpose
 * by `--host-resolver-rules` in playwright.config.ts, so its resource errors are
 * our own doing and must not fail a test.
 *
 * Derived from the same inputs as the block rather than written out as a list of
 * regexes. An enumerated list goes stale the moment someone adds a font, an
 * avatar host or an image CDN — and the failure mode is a red suite with a
 * cause nobody can find. This is the exact complement of what we permit, so it
 * cannot drift.
 *
 * Note this is *not* the blanket `/\/rest\/v1\//` rule that used to live here.
 * Supabase is an allowed host, so its errors still fail tests — which is the
 * whole point.
 */
const RELAY_MODE = process.env.E2E_USE_RELAY === '1';

function allowedHosts(): Set<string> {
  const hosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  // cdn.jsdelivr.net and esm.sh used to be listed here so Monaco could load.
  // Monaco is bundled now, and esm.sh is only ever imported by the Deno edge
  // functions, so neither is a host any page reaches. Leaving them allowed
  // would mean a regression to CDN loading still counted as healthy.
  try {
    hosts.add(new URL(process.env.VITE_SUPABASE_URL ?? 'https://siuqvhscuiycvdrtiqsh.supabase.co').hostname);
  } catch {
    // Malformed env: fall through with the loopback defaults.
  }
  return hosts;
}
const ALLOWED_HOSTS = allowedHosts();

function isDeliberatelyBlocked(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  // Blocked in every mode — see hermeticArgs() in playwright.config.ts.
  if (hostname === 'cdn.gpteng.co') return true;
  // Everything else is only blocked under E2E_USE_RELAY. Outside relay mode the
  // suite reaches the real internet, so a failure from a third party is a real
  // third-party failure and belongs in the named suppressions above (or nowhere)
  // rather than being waved through by this rule.
  return RELAY_MODE && !ALLOWED_HOSTS.has(hostname);
}

function shouldIgnore(msg: ConsoleMessage): boolean {
  const text = msg.text();

  // Check text-based patterns first (covers app console.error calls)
  if (IGNORED_PATTERNS.some((rule) => (typeof rule === 'function' ? rule(text) : rule.test(text)))) {
    return true;
  }

  // For browser-native "Failed to load resource" errors the URL is in
  // msg.location(), not msg.text() — check URL patterns separately.
  if (text.startsWith('Failed to load resource:')) {
    const url = msg.location()?.url ?? '';
    if (IGNORED_URL_PATTERNS.some((pattern) => pattern.test(url))) return true;
    // A host we blocked ourselves. See allowedHosts() above.
    if (isDeliberatelyBlocked(url)) return true;
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

// Which recorded issues count as defects lives in src/, next to the
// instrumentation it describes, so it can be unit-tested. A pass/fail predicate
// that nothing can test is how the suppression lists above drifted into hiding
// real defects in the first place.

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
          // Redacted BEFORE the slice, not after: truncating first can cut a
          // credential in half and leave the front of it in the record.
          text: redactText(msg.text()).slice(0, 500),
          url: redactUrl(msg.location()?.url ?? ''),
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
        auditRecord({
          ...where,
          kind: 'pageerror',
          ignored,
          text: redactText(fakeMsg.text()).slice(0, 500),
          url: '',
        });
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
          // This is the line that would have published credentials. A failing
          // request is exactly when this fires, and several URLs the app
          // requests carry a token in the query — Supabase signed storage URLs
          // and the private calendar feed. Redact before truncating.
          url: redactUrl(res.url()).slice(0, 400),
        });
      };

      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      if (AUDIT) page.on('response', onResponse);

      await use(errors);

      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      if (AUDIT) page.off('response', onResponse);

      // Structured check first: it is the more specific failure, and reporting
      // "column profiles.full_name does not exist on /courses/:id/quiz-results"
      // is far more useful than whichever console line happened to be emitted.
      const issues: SupabaseIssue[] = await page
        .evaluate(() => (window as unknown as { __supabaseIssues?: SupabaseIssue[] }).__supabaseIssues ?? [])
        .catch(() => []);          // page already closed, or navigated away
      const structural = structuralIssues(issues);

      for (const issue of structural) {
        auditRecord({ ...where, kind: 'supabase-issue', ignored: false, ...issue });
      }

      if (structural.length > 0) {
        expect(
          structural,
          `Test "${testInfo.title}" hit ${structural.length} Supabase request(s) that cannot succeed:\n` +
            `${structural.map(describeIssue).join('\n')}\n\n` +
            `These are structural — a missing column, table, relationship or function, a filter built\n` +
            `from undefined, or a write that changed nothing. None of them is an empty-data condition,\n` +
            `so none can be "expected in the test environment". Fix the query or the guard.`,
        ).toHaveLength(0);
      }

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
