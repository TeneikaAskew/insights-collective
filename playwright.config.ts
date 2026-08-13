import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadDotenv } from 'dotenv';
import { chromiumExecutableOption } from './e2e/support/chromium-executable';


// Load .env so E2E_* credentials are available to global-setup and tests
loadDotenv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Relay mode runs on its own port, and that is a correctness requirement rather
 * than tidiness.
 *
 * `reuseExistingServer` is true, so with a dev server already listening on 8080
 * — the Lovable sandbox always has one — Playwright silently adopted it and
 * skipped scripts/e2e/serve.mjs entirely. That server points at
 * https://<ref>.supabase.co, which the hermetic `MAP *` rule resolves to a
 * closed port, so every Supabase call died in the browser and the app rendered
 * "We couldn't load your account's permissions" / "We're having trouble
 * loading". The relay was fine and never involved; the suite was simply
 * pointed at the wrong server. Using a dedicated port means the relay-backed
 * server is the only thing that can answer.
 */
const RELAY_MODE = process.env.E2E_USE_RELAY === '1';
const APP_PORT = process.env.E2E_APP_PORT || (RELAY_MODE ? '8090' : '8080');

/**
 * Relay mode owns its port, so an E2E_BASE_URL naming a different one is stale
 * and must lose.
 *
 * `.env` ships `E2E_BASE_URL=http://localhost:8080` — correct for a normal run,
 * and loaded above by loadDotenv() into a variable this line reads. Under
 * E2E_USE_RELAY=1 the app is served on 8090, so that value pointed the whole
 * suite at port 8080: the readiness probe found nothing there, Playwright
 * started serve.mjs anyway, vite died with "Port 8090 is already in use", and
 * the run failed with "Timed out waiting 120000ms from config.webServer" — a
 * message that says nothing about the port it was actually watching.
 *
 * An explicit E2E_BASE_URL on the command line still wins whenever it agrees
 * with the port in use, which is what a remote or preview-server run needs.
 */
function resolveBaseUrl(): string {
  const configured = process.env.E2E_BASE_URL;
  if (!configured) return `http://localhost:${APP_PORT}`;
  if (!RELAY_MODE) return configured;

  const configuredPort = (() => {
    try {
      return new URL(configured).port;
    } catch {
      return '';
    }
  })();
  if (configuredPort === APP_PORT) return configured;

  console.error(
    `[e2e] Ignoring E2E_BASE_URL=${configured}: relay mode serves the app on ` +
      `port ${APP_PORT}. Set E2E_APP_PORT to move it.`,
  );
  return `http://localhost:${APP_PORT}`;
}

const BASE_URL = resolveBaseUrl();

// Nine spec/helper modules build absolute URLs from
// `process.env.E2E_BASE_URL || 'http://localhost:8080'` instead of Playwright's
// injected `baseURL`. Unset, that default points at whatever already listens on
// 8080 — in this sandbox the platform's own dev server, which talks to
// https://<ref>.supabase.co and therefore dies behind the hermetic
// host-resolver rule. Publishing the resolved value here is what keeps those
// modules on the same server as the rest of the run.
process.env.E2E_BASE_URL = BASE_URL;

const SESSIONS_DIR = path.join(__dirname, '.playwright-sessions');

/**
 * Make the browser hermetic: every host except this machine resolves to a closed
 * port, so a third party can never decide whether the suite passes.
 *
 * This is not a preference. `page.goto` waits for `load`, which does not fire
 * until every subresource settles, and the app pulls in two third-party
 * resources on every single page:
 *
 *   index.html:26   https://cdn.gpteng.co/gptengineer.js   (Lovable's editor)
 *   src/index.css:1 https://fonts.googleapis.com/css2...   (@import, render-blocking)
 *
 * Measured against the same server: unblocked, /login times out at 25s.
 * Blocked, it loads in 630ms. When those hosts are merely slow rather than
 * unreachable the suite does not fail outright — it just gets slower and
 * flakier, which is worse because nobody investigates it.
 *
 * i.pravatar.cc (landing-page avatars) is covered by the same rule; it had
 * already been rate-limiting long enough to earn its own suppression entry.
 *
 * Supabase is the one external host the app legitimately needs, so it is
 * excluded — unless E2E_USE_RELAY=1, in which case it is reached over loopback
 * and needs no exception. Blocking it unconditionally would have made the suite
 * pass here and fail everywhere else.
 *
 * `localhost` is excluded by name. 127.0.0.1 needs no exclusion because an IP
 * literal never goes through the resolver — and do not add one anyway: an
 * EXCLUDE Chromium cannot parse makes it discard the entire rule string, and
 * then nothing is blocked at all and the timeouts come back.
 */
function hermeticArgs(): string[] {
  // cdn.gpteng.co is blocked everywhere. It is Lovable's editor script, it
  // contributes nothing to what the app renders, and it gates `load` on every
  // navigation. Blocking it is pure upside.
  const rules = ['MAP cdn.gpteng.co 127.0.0.1:1'];

  // Everything else is blocked only in relay mode — that is, only where the
  // browser has no egress anyway and a request to a third party can do nothing
  // but hang.
  //
  // Blocking them in CI would be actively wrong. Google Fonts changes the
  // typography of every page and images.unsplash.com fills the course cards,
  // so a suite that blocks them is screenshotting a different application than
  // the one users see, and every visual baseline captured that way is a lie.
  // The corollary is that visual regression cannot be validated under
  // E2E_USE_RELAY=1 — do not refresh baselines from a run that blocked fonts.
  if (process.env.E2E_USE_RELAY === '1') {
    return [
      // cdn.jsdelivr.net and esm.sh were excluded here so a code-practice
      // failure would read as "the CDN is unreachable" rather than "the suite
      // blocked it". Monaco is bundled now and loads from this origin, so there
      // is nothing left to be honest about — and blocking them means a
      // regression to CDN loading fails here instead of quietly working on a
      // machine with egress.
      '--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost',
    ];
  }

  return [`--host-resolver-rules=${rules.join(',')}`];
}

/**
 * The Firefox equivalent of hermeticArgs(), and gated identically.
 *
 * Outside relay mode Firefox gets no proxy at all, so it reaches Supabase, the
 * fonts and the images exactly as Chromium does. Inside relay mode everything
 * but loopback goes to a closed port, and the relay — which is what Supabase
 * traffic actually goes to there — is exempted by `no_proxies_on`.
 */
function firefoxHermeticOptions(): { firefoxUserPrefs?: Record<string, unknown> } {
  if (process.env.E2E_USE_RELAY !== '1') return {};
  return {
    firefoxUserPrefs: {
      'network.proxy.type': 1,
      'network.proxy.http': '127.0.0.1',
      'network.proxy.http_port': 1,
      'network.proxy.ssl': '127.0.0.1',
      'network.proxy.ssl_port': 1,
      'network.proxy.no_proxies_on': 'localhost, 127.0.0.1',
    },
  };
}

const HERMETIC_ARGS = hermeticArgs();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : 2,
  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'test-results.json' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['github'],
        ['list'],
      ]
    : [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
      ],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    // CI captures full diagnostics on any failure; local keeps the lighter defaults.
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    launchOptions: {
      args: HERMETIC_ARGS,
      // Probed, not assumed: the bundled chrome-headless-shell cannot start in
      // sandboxes missing its GTK/glib libraries. See e2e/support/chromium-executable.ts.
      ...chromiumExecutableOption(),
    },

  },
  /**
   * Start the app if it is not already up.
   *
   * There was no webServer block, so the suite tested whatever happened to be
   * listening on 8080 — and when that was nothing, every spec failed with a
   * navigation timeout that looked like an application fault.
   *
   * reuseExistingServer is true unconditionally, including CI: the workflow
   * starts its own preview server against the production build, and this must
   * defer to it rather than fight for the port.
   */
  webServer: {
    command: RELAY_MODE
      ? `node scripts/e2e/serve.mjs`
      : `npx vite --host 127.0.0.1 --port ${APP_PORT}`,
    url: BASE_URL,
    // In relay mode APP_PORT is dedicated, so "existing" can only mean a relay
    // server from a previous run — safe to reuse and cheap to keep.
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { E2E_APP_PORT: APP_PORT },
  },

  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  projects: [
    // Chromium — member role (most feature tests)
    {
      name: 'chromium-member',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(SESSIONS_DIR, 'member.json'),
      },
      testIgnore: [
        '**/admin/**',
        '**/auth/**',
        '**/landing/**',
        '**/visual/**',
        // Signed-out specs — handled by chromium-public. The first four were
        // absent from this list while chromium-public claimed them, so ~44 test
        // executions ran twice: once authenticated, once not, with identical
        // assertions either way.
        '**/legal/**',
        '**/survey/**',
        '**/blog/**',
        '**/portfolio/public-portfolio.spec.ts',
        '**/career/career-pathway-public.spec.ts',
        // Destructive completion journeys — handled by chromium-member-journeys
        // on a separate account. See that project for why.
        '**/journeys/certificate-generation.spec.ts',
        '**/journeys/full-completion-sequence.spec.ts',
        // Asserts the LOGGED-OUT code-practice experience ("the hub is public,
        // so no auth is required", and it expects the Demo-mode result badge).
        // Claimed by this project it ran with a member session, where the page
        // performs a real evaluation instead — so it asserted the opposite of
        // what happens and could never pass. Its sibling
        // interview-prep-design/code-evaluation.spec.ts is signed-in BY DESIGN
        // and deliberately stays here.
        '**/interview-prep-design/soft-studio-hub.spec.ts',
        // Instructor-only specs — handled by chromium-instructor project
        '**/courses/course-builder.spec.ts',
        '**/courses/course-builder-verification.spec.ts',
        '**/courses/course-management.spec.ts',
        '**/courses/course-gradebook.spec.ts',
        '**/courses/course-rubrics.spec.ts',
        '**/courses/course-question-banks.spec.ts',
        '**/assignments/grading-interface.spec.ts',
        '**/assignments/submission-attachments.spec.ts',
        // Instructor-only: students never see the bulk download control, so
        // running it with a member session asserts the opposite of the truth.
        '**/assignments/bulk-attachment-download.spec.ts',

        '**/journeys/grading-workflow-flow.spec.ts',
        '**/instructor/**',
      ],
    },
    // Chromium — second member account, for the completion journeys that reset
    // state to prove auto-issuance.
    //
    // These specs delete the acting user's certificates and progressions for
    // the reference course before rebuilding them. Run as the shared member
    // that is destructive to specs which only read: profile-certificates-flow
    // asserts the member's certificate list, and the /profile visual snapshot
    // renders it at a 1% pixel tolerance. Since the suite is fullyParallel,
    // both saw a list whose contents depended on where these journeys had got
    // to. Certificates are per (user, course) and RLS scopes deletes to the
    // acting user, so moving the journeys to their own account makes the
    // shared member's certificate set constant.
    //
    // It also splits the two specs that grade fixture assignment
    // aa0e8400-...0001: submissions are keyed per (assignment, user), so with
    // full-completion-sequence here and assignment-submission-feedback still
    // on the shared member, they write separate rows instead of racing to
    // overwrite one grade.
    {
      name: 'chromium-member-journeys',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(SESSIONS_DIR, 'journeys.json'),
      },
      testMatch: [
        '**/journeys/certificate-generation.spec.ts',
        '**/journeys/full-completion-sequence.spec.ts',
      ],
    },
    // Chromium — admin role
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(SESSIONS_DIR, 'admin.json'),
      },
      testMatch: ['**/admin/**'],
    },
    // Chromium — instructor role (course builder, grading)
    {
      name: 'chromium-instructor',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(SESSIONS_DIR, 'instructor.json'),
      },
      testMatch: [
        '**/courses/course-builder.spec.ts',
        '**/courses/course-builder-verification.spec.ts',
        '**/courses/course-management.spec.ts',
        '**/courses/course-gradebook.spec.ts',
        '**/courses/course-rubrics.spec.ts',
        '**/courses/course-question-banks.spec.ts',
        '**/assignments/grading-interface.spec.ts',
        '**/assignments/submission-attachments.spec.ts',
        '**/assignments/bulk-attachment-download.spec.ts',


        '**/journeys/grading-workflow-flow.spec.ts',
        // Specs that are inherently instructor-role live under e2e/instructor/.
        '**/instructor/**',
      ],
    },
    // Unauthenticated — auth flows, landing, public pages
    {
      name: 'chromium-public',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/auth/**',
        '**/landing/**',
        '**/legal/**',
        '**/portfolio/public-portfolio.spec.ts',
        '**/survey/**',
        '**/blog/**',
        '**/career/career-pathway-public.spec.ts',
        '**/interview-prep-design/soft-studio-hub.spec.ts',
      ],
    },
    // Cross-browser smoke tests: Firefox + WebKit on critical paths
    // These use higher timeouts because Firefox/WebKit are substantially
    // slower than Chromium in this codespace environment.
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: path.join(SESSIONS_DIR, 'member.json'),
        navigationTimeout: 45_000,
        actionTimeout: 20_000,
        // Firefox ignores --host-resolver-rules, so the equivalent hermetic
        // block is a proxy pointed at a closed port.
        //
        // Gated on relay mode for the same reason hermeticArgs() is, and the
        // omission here was a real defect: unconditionally, this sent *every*
        // HTTPS host to the closed port — including the Supabase project. Global
        // setup authenticates in Node and hands Firefox a stored token, so the
        // pages still rendered while every data request died, and the dashboard
        // and course-list specs asserted against empty state and passed. A suite
        // that goes green against an app with no data is worse than one that
        // fails. (Caught in review on PR #30.)
        launchOptions: firefoxHermeticOptions(),
      },
      timeout: 90_000,
      testMatch: [
        '**/dashboard/**',
        '**/courses/course-list.spec.ts',
      ],
    },
    // WebKit (Safari) is extremely slow in this codespace environment (>90s per test)
    // and is disabled until a faster runner is available.
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     storageState: path.join(SESSIONS_DIR, 'member.json'),
    //   },
    //   timeout: 150_000,
    //   testMatch: ['**/dashboard/**', '**/auth/login.spec.ts'],
    // },
    // Visual regression — a single unauthenticated project. The spec itself
    // creates a per-route context with the correct role's storageState so every
    // route actually runs (no role-gated skips). Baselines live under
    // e2e/visual/visual-regression.spec.ts-snapshots/<name>-visual-linux.png.
    {
      name: 'visual',
      testMatch: ['**/visual/**'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
