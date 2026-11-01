// ABOUTME: Labelled frontend evidence for an isolated local run: screenshots of the course catalog, a course
// ABOUTME: detail page and a member-denied admin route at desktop, tablet and mobile viewports, each paired in a manifest
// ABOUTME: with the commit, environment, viewport, backend mode and the API/data/permission outcomes observed.
// Everything is a Playwright attachment: the screenshot Buffer, a JSON sidecar per screenshot and a JSON manifest per
// viewport, all awaited, so the spec itself writes nothing to disk; the html reporter keeps them in playwright-report/,
// which the workflow uploads. Attachment names carry the retry index, so a retried test cannot overwrite or be
// confused with the first attempt. Every attached value is validated by evidence-metadata.mjs: labels must be a
// 40-hex SHA and printable ASCII or the spec refuses to run; API metadata is method/path/status/row count/UUID ids
// only (no query strings, no bodies); a response from any origin other than the configured loopback API has its
// body never read: it is recorded only as origin FOREIGN with its validated method, path and status, and it fails
// the backend assertion. Each screenshot's metadata comes from ONE immutable API snapshot taken after the screenshot
// and after every pending observation settled; backend mode and outcome are both derived from that snapshot.
// CodeQL's repo-wide js/http-to-file-access exclusion is not relied on and not claimed to cover this spec.
// Backend mode is MEASURED, not declared: the spec installs no route stubs. Save is NOT exercised: the
// readonly-courses dispatch scope authorises no mutation, and the manifest says so instead of implying it.
import { test, expect } from '../fixtures/page-helpers';
import { waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';
import type { Page, Response, TestInfo } from '@playwright/test';
import { validateLabels, attachmentName, apiRecord, appPath, status as httpStatus, STEPS, AUTHENTIC, createApiObserver, captureWindow } from './evidence-metadata.mjs';

const API = process.env.VITE_SUPABASE_URL || '';
const LABEL_CHECK = validateLabels(process.env);
const LABELS = LABEL_CHECK.labels;
const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
];
// The exact seeded course (scripts/local-db/local-preseed.sql). Any other heading is a failure, not evidence.
const SEEDED_COURSE = { id: '660e8400-e29b-41d4-a716-446655440001', title: 'Introduction to Data Science' };
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

type ApiCall = { origin: string; method: string; path: string; status: number; rows: number | null; courseIds: string[]; rejectedIds: number };
type Step = (typeof STEPS)[number];

function isLoopback(u: URL) { return ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname); }
const API_URL = (() => { try { return API ? new URL(API) : null; } catch { return null; } })();
const API_OK = Boolean(API_URL && isLoopback(API_URL));

type Observer = ReturnType<typeof createApiObserver>;

function recordApi(page: Page, observer: Observer) {
  page.on('response', (r: Response) => {
    const u = new URL(r.url());
    if (!/^\/(rest|auth|functions|storage)\/v1\//.test(u.pathname)) return;
    const isConfiguredApi = API_OK && u.origin === API_URL.origin;
    observer.record(apiRecord({
      isConfiguredApi, pathname: u.pathname, requestMethod: r.request().method(), responseStatus: r.status(),
      contentType: r.headers()['content-type'] || '', readJson: () => r.json(),
    }));
  });
}

// Is the browser's stored session still accepted by the auth server? Distinguishes "signed in but refused" from
// "signed out and bounced to /login" without trusting the app's own rendering. Only booleans and the status persist.
async function sessionState(page: Page) {
  const token = await page.evaluate(() => {
    try { const v = JSON.parse(localStorage.getItem('supabase.auth.token') || 'null'); return v?.access_token || v?.currentSession?.access_token || null; } catch { return null; }
  });
  if (!token || !API_OK) return { storedSession: Boolean(token), authUserStatus: 0, valid: false };
  const r = await page.request.get(`${API_URL.origin}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY } });
  return { storedSession: true, authUserStatus: httpStatus(r.status()), valid: r.status() === 200 };
}

type Entry = Record<string, unknown>;

// Screenshot, then settle, then ONE snapshot; backend and outcome both come from that snapshot (captureWindow).
// Attach, then assert, so a failing window still leaves its evidence.
async function capture(page: Page, info: TestInfo, vp: string, step: Step, observer: Observer,
  outcomeFrom: (api: readonly ApiCall[]) => Record<string, unknown>, manifest: Entry[]) {
  const files = {
    png: attachmentName({ commit: LABELS.commit, viewport: vp, step, retry: info.retry, kind: 'png' }),
    json: attachmentName({ commit: LABELS.commit, viewport: vp, step, retry: info.retry, kind: 'json' }),
  };
  const url = appPath(new URL(page.url()).pathname);
  const w = await captureWindow({ observer, screenshot: () => page.screenshot({ fullPage: true }), apiOk: API_OK, outcomeFrom });
  const entry: Entry = {
    files, commit: LABELS.commit, environment: LABELS.environment, viewport: vp, step,
    run: { retry: info.retry, workerIndex: info.workerIndex, parallelIndex: info.parallelIndex, repeatEachIndex: info.repeatEachIndex },
    url, apiOrigin: API_OK ? API_URL.origin : 'unset or not loopback', backend: w.backend, api: w.api, outcome: w.outcome,
    capturedAt: new Date().toISOString(),
  };
  manifest.push(entry);
  await info.attach(files.png, { body: w.png, contentType: 'image/png' });
  await info.attach(files.json, { body: Buffer.from(JSON.stringify(entry, null, 2)), contentType: 'application/json' });
  expect(w.backend.mode, `backend for ${step}`).toBe(AUTHENTIC);
  return w.outcome;
}

const coursesOk = (c: ApiCall) => c.path === '/rest/v1/courses' && c.method === 'GET' && c.status === 200;

for (const vp of VIEWPORTS) {
  test.describe(`frontend evidence @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('catalog, detail and a member-denied admin route, with paired outcomes', async ({ page }, info) => {
      expect(LABEL_CHECK.problems, 'evidence labels must be valid before any screen is captured').toEqual([]);
      expect(API_OK, 'VITE_SUPABASE_URL must be a loopback URL').toBe(true);
      const observer = createApiObserver();
      const manifest: Entry[] = [];
      let securityLogCalls: number | null = null;
      recordApi(page, observer);
      // The per-viewport manifest is attached even when an assertion fails part-way, so a failed run still shows
      // every screenshot taken and its paired outcome.
      try {
        await page.goto(Routes.courses); await waitForPageLoad(page);
        const cards = page.locator('[data-onboarding="course-grid"]').locator('button:has(h3)');
        await expect(cards.first()).toBeVisible();
        const shown = await cards.count();
        await capture(page, info, vp.name, '01-catalog', observer, (api) => ({
          data: { cardsRendered: shown, coursesApiResponses: api.filter(coursesOk).map((c) => c.rows) },
          save: 'NOT EXERCISED (read-only dispatch scope)',
        }), manifest);

        await page.goto(Routes.courseDetail(SEEDED_COURSE.id)); await waitForPageLoad(page);
        const heading = page.locator('h1:visible').filter({ hasText: SEEDED_COURSE.title });
        await expect(page).toHaveURL((u) => u.pathname === `/courses/${SEEDED_COURSE.id}`);
        await expect(heading.first()).toBeVisible();
        const headingMatches = (await heading.first().innerText()).trim() === SEEDED_COURSE.title;
        const detail = await capture(page, info, vp.name, '02-course-detail', observer, (api) => {
          const rowReads = api.filter((c) => coursesOk(c) && c.courseIds.includes(SEEDED_COURSE.id));
          return {
            data: {
              expected: SEEDED_COURSE, path: appPath(new URL(page.url()).pathname), headingEqualsExpectedTitle: headingMatches,
              coursesResponsesContainingSeededId: rowReads.map((c) => ({ method: c.method, status: c.status, rows: c.rows })),
              failedApi: api.filter((c) => c.status >= 400).map((c) => ({ status: c.status, path: c.path })),
            },
            save: 'NOT EXERCISED (read-only dispatch scope)',
          };
        }, manifest) as { data: { coursesResponsesContainingSeededId: unknown[] } };
        expect(headingMatches, 'the detail page must show the seeded course title exactly, not any h1').toBe(true);
        expect(detail.data.coursesResponsesContainingSeededId.length, 'the seeded course row must come back from the local REST API').toBeGreaterThan(0);

        const before = await sessionState(page);
        expect(before.valid, 'precondition: a valid member session before requesting /admin').toBe(true);
        await page.goto(Routes.admin); await waitForPageLoad(page);
        // Capture only a SETTLED denial: the destination's own heading rendered (not just the URL, which changes
        // before the router commits the new screen) and the toast shown. Both are conditions, not delays; if either
        // never happens the outcome says so and the screenshot shows what was actually on screen.
        const dashboardHeading = page.getByRole('heading', { name: 'Dashboard', exact: true }).filter({ visible: true });
        const dashboardShown = await dashboardHeading.first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
        const finalPath = appPath(new URL(page.url()).pathname);
        const toast = page.getByText('Access Denied', { exact: true }).filter({ visible: true });
        const toastShown = finalPath === '/dashboard' && await toast.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
        const toastCount = await toast.count();
        const after = await sessionState(page);
        // Three outcomes, never conflated: an authenticated member refused (/dashboard, session still valid, toast),
        // a signed-out bounce (/login: the session was lost, which is NOT a permission result), or access granted.
        const outcome = finalPath === '/dashboard' && dashboardShown && after.valid && toastShown && toastCount === 1 ? 'AUTHENTICATED MEMBER DENIED'
          : finalPath === '/dashboard' && after.valid && (!dashboardShown || toastCount !== 1) ? 'DENIAL NOT SETTLED (see dashboardShown and accessDeniedToasts)'
          : finalPath === '/login' ? 'SIGNED OUT (redirected to /login; not a member denial)'
          : finalPath.startsWith('/admin') ? 'ADMIN ROUTE RENDERED FOR MEMBER'
          : 'UNEXPECTED (see finalPath, sessionAfter and accessDeniedToast)';
        const denial = await capture(page, info, vp.name, '03-admin-as-member', observer, (api) => ({
          permission: { requested: Routes.admin, finalPath, outcome, sessionBefore: before, sessionAfter: after, accessDeniedToast: toastShown,
            dashboardShown, accessDeniedToasts: toastCount },
          // Counted from the same snapshot as the screenshot. Request bodies are not recorded, so these are call counts,
          // not event types.
          securityEvents: { logSecurityEventCalls: api.filter((c) => c.path === '/rest/v1/rpc/log_security_event').length,
            adminChecks: api.filter((c) => c.path === '/rest/v1/rpc/has_admin_access').length },
          save: 'NOT EXERCISED (read-only dispatch scope)',
        }), manifest) as { securityEvents: { logSecurityEventCalls: number; adminChecks: number } };
        securityLogCalls = denial.securityEvents.logSecurityEventCalls;
        expect(outcome, 'a signed-in member must be refused at /admin and stay signed in').toBe('AUTHENTICATED MEMBER DENIED');
      } finally {
        // Anything that arrived after the last window is reported, not dropped: a late FOREIGN response fails here.
        await observer.settle();
        const tail = observer.snapshot();
        const tailForeign = tail.filter((c) => c.origin !== 'configured-loopback-api').length;
        // Only when the labels validated: a name is never built from an unvalidated label.
        if (LABEL_CHECK.ok) {
          await info.attach(attachmentName({ commit: LABELS.commit, viewport: vp.name, step: 'manifest', retry: info.retry, kind: 'json' }),
            { body: Buffer.from(JSON.stringify({ windows: manifest, afterLastWindow: { api: tail, foreignResponses: tailForeign } }, null, 2)), contentType: 'application/json' });
        }
        expect(tailForeign, 'no FOREIGN API response after the last screenshot').toBe(0);
        // One route-access entry and one denial entry per refused request; a repeat loop shows up here even if its
        // later calls arrive after the screenshot.
        if (securityLogCalls !== null) {
          const late = tail.filter((c) => c.path === '/rest/v1/rpc/log_security_event').length;
          expect(securityLogCalls + late, 'log_security_event calls for one refused /admin request (window + after)').toBeLessThanOrEqual(2);
        }
      }
    });
  });
}
