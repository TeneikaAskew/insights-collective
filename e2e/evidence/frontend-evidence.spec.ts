// ABOUTME: Labelled frontend evidence for an isolated local run: screenshots of the course catalog, a course
// ABOUTME: detail page and a member-denied admin route at desktop, tablet and mobile viewports, each paired in a manifest
// ABOUTME: with the commit, environment, viewport, backend mode and the API/data/permission outcomes observed.
// Backend mode is MEASURED, not declared: the spec installs no route stubs and fails if any Supabase API
// response comes from a host other than the configured loopback API. Save is NOT exercised: the
// readonly-courses dispatch scope authorises no mutation, and the manifest says so instead of implying it.
import { test, expect } from '../fixtures/page-helpers';
import { waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';
import type { Page, Response, TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('test-results', 'frontend-evidence');
const API = process.env.VITE_SUPABASE_URL || '';
const LABELS = {
  commit: process.env.E2E_EVIDENCE_COMMIT || 'UNLABELLED',
  environment: process.env.E2E_EVIDENCE_ENVIRONMENT || 'UNLABELLED',
};
const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
];
// The exact seeded course (scripts/local-db/local-preseed.sql). Any other heading is a failure, not evidence.
const SEEDED_COURSE = { id: '660e8400-e29b-41d4-a716-446655440001', title: 'Introduction to Data Science' };
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

type ApiCall = { method: string; host: string; path: string; query: string; status: number; rows: number | null; courseIds?: string[] };

function isLoopback(u: URL) { return ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname); }

function recordApi(page: Page, calls: ApiCall[]) {
  page.on('response', async (r: Response) => {
    const u = new URL(r.url());
    if (!/^\/(rest|auth|functions|storage)\/v1\//.test(u.pathname)) return;
    let rows: number | null = null; let courseIds: string[] | undefined;
    try {
      const ct = r.headers()['content-type'] || '';
      if (ct.includes('json')) {
        const b = await r.json(); const list = Array.isArray(b) ? b : b && typeof b === 'object' ? [b] : [];
        rows = Array.isArray(b) ? b.length : null;
        if (u.pathname === '/rest/v1/courses') courseIds = list.map((x: { id?: string }) => x?.id).filter(Boolean).slice(0, 50);
      }
    } catch { /* body unavailable */ }
    calls.push({ method: r.request().method(), host: u.host, path: u.pathname, query: decodeURIComponent(u.search).slice(0, 300), status: r.status(), rows, courseIds });
  });
}

// Is the browser's stored session still accepted by the auth server? Distinguishes "signed in but refused" from
// "signed out and bounced to /login" without trusting the app's own rendering.
async function sessionState(page: Page) {
  const token = await page.evaluate(() => {
    try { const v = JSON.parse(localStorage.getItem('supabase.auth.token') || 'null'); return v?.access_token || v?.currentSession?.access_token || null; } catch { return null; }
  });
  if (!token || !API) return { storedSession: Boolean(token), authUserStatus: null as number | null, valid: false };
  const r = await page.request.get(`${API}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY } });
  return { storedSession: true, authUserStatus: r.status(), valid: r.status() === 200 };
}

function backendMode(calls: ApiCall[]) {
  const api = API ? new URL(API) : null;
  const foreign = calls.filter((c) => !api || c.host !== api.host);
  return {
    mode: api && isLoopback(api) && foreign.length === 0 && calls.length > 0 ? 'authentic local Supabase (loopback, no stubs)' : 'NOT AUTHENTIC',
    apiOrigin: api ? api.origin : 'unset', foreignHosts: [...new Set(foreign.map((c) => c.host))], stubs: 0,
  };
}

async function capture(page: Page, info: TestInfo, vp: string, step: string, calls: ApiCall[], outcome: Record<string, unknown>) {
  mkdirSync(OUT, { recursive: true });
  const file = `${LABELS.commit.slice(0, 12)}__${vp}__${step}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  const entry = { file, ...LABELS, viewport: vp, url: new URL(page.url()).pathname, backend: backendMode(calls), api: calls.slice(), outcome, capturedAt: new Date().toISOString() };
  writeFileSync(path.join(OUT, file.replace(/\.png$/, '.json')), JSON.stringify(entry, null, 2));
  appendFileSync(path.join(OUT, 'manifest.jsonl'), JSON.stringify(entry) + '\n');
  await info.attach(file, { path: path.join(OUT, file), contentType: 'image/png' });
  expect(entry.backend.mode, `backend for ${step}`).toBe('authentic local Supabase (loopback, no stubs)');
}

for (const vp of VIEWPORTS) {
  test.describe(`frontend evidence @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('catalog, detail and a member-denied admin route, with paired outcomes', async ({ page }, info) => {
      expect(LABELS.commit, 'E2E_EVIDENCE_COMMIT must label every screenshot').not.toBe('UNLABELLED');
      const calls: ApiCall[] = [];
      recordApi(page, calls);

      await page.goto(Routes.courses); await waitForPageLoad(page);
      const cards = page.locator('[data-onboarding="course-grid"]').locator('button:has(h3)');
      await expect(cards.first()).toBeVisible();
      const shown = await cards.count();
      const courseReads = calls.filter((c) => c.path === '/rest/v1/courses' && c.method === 'GET' && c.status === 200);
      await capture(page, info, vp.name, '01-catalog', calls, {
        data: { cardsRendered: shown, coursesApiResponses: courseReads.map((c) => c.rows) },
        save: 'NOT EXERCISED (read-only dispatch scope)',
      });

      calls.length = 0;
      const detailPath = Routes.courseDetail(SEEDED_COURSE.id);
      await page.goto(detailPath); await waitForPageLoad(page);
      const heading = page.locator('h1:visible').filter({ hasText: SEEDED_COURSE.title });
      await expect(page).toHaveURL((u) => u.pathname === `/courses/${SEEDED_COURSE.id}`);
      await expect(heading.first()).toBeVisible();
      const headingText = (await heading.first().innerText()).trim();
      const rowReads = calls.filter((c) => c.path === '/rest/v1/courses' && c.method === 'GET' && c.status === 200 && (c.courseIds || []).includes(SEEDED_COURSE.id));
      await capture(page, info, vp.name, '02-course-detail', calls, {
        data: {
          expected: SEEDED_COURSE, path: new URL(page.url()).pathname, heading: headingText,
          coursesRowsContainingSeededId: rowReads.map((c) => ({ query: c.query, rows: c.rows })),
          failedApi: calls.filter((c) => c.status >= 400).map((c) => `${c.status} ${c.path}`),
        },
        save: 'NOT EXERCISED (read-only dispatch scope)',
      });
      expect(headingText, 'the detail page must show the seeded course, not any h1').toBe(SEEDED_COURSE.title);
      expect(rowReads.length, 'the seeded course row must come back from the local REST API').toBeGreaterThan(0);

      calls.length = 0;
      const before = await sessionState(page);
      expect(before.valid, 'precondition: a valid member session before requesting /admin').toBe(true);
      await page.goto(Routes.admin); await waitForPageLoad(page);
      const finalPath = new URL(page.url()).pathname;
      const toast = page.getByText('Access Denied', { exact: true }).filter({ visible: true });
      const toastShown = finalPath === '/dashboard' && await toast.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
      const after = await sessionState(page);
      // Three outcomes, never conflated: an authenticated member refused (/dashboard, session still valid, toast),
      // a signed-out bounce (/login: the session was lost, which is NOT a permission result), or access granted.
      const outcome = finalPath === '/dashboard' && after.valid && toastShown ? 'AUTHENTICATED MEMBER DENIED'
        : finalPath === '/login' ? 'SIGNED OUT (redirected to /login; not a member denial)'
        : finalPath.startsWith('/admin') ? 'ADMIN ROUTE RENDERED FOR MEMBER'
        : `UNEXPECTED (${finalPath}; session valid ${after.valid}; toast ${toastShown})`;
      await capture(page, info, vp.name, '03-admin-as-member', calls, {
        permission: { requested: Routes.admin, finalPath, outcome, sessionBefore: before, sessionAfter: after, accessDeniedToast: toastShown },
        save: 'NOT EXERCISED (read-only dispatch scope)',
      });
      expect(outcome, 'a signed-in member must be refused at /admin and stay signed in').toBe('AUTHENTICATED MEMBER DENIED');
    });
  });
}
