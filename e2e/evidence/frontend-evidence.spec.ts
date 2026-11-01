// ABOUTME: Labelled frontend evidence for an isolated local run: screenshots of the course catalog, a course
// ABOUTME: detail page and a member-denied admin route at desktop and mobile viewports, each paired in a manifest
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
  { name: 'mobile-390x844', width: 390, height: 844 },
];

type ApiCall = { method: string; host: string; path: string; status: number; rows: number | null };

function isLoopback(u: URL) { return ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname); }

function recordApi(page: Page, calls: ApiCall[]) {
  page.on('response', async (r: Response) => {
    const u = new URL(r.url());
    if (!/^\/(rest|auth|functions|storage)\/v1\//.test(u.pathname)) return;
    let rows: number | null = null;
    try { const ct = r.headers()['content-type'] || ''; if (ct.includes('json')) { const b = await r.json(); rows = Array.isArray(b) ? b.length : null; } } catch { /* body unavailable */ }
    calls.push({ method: r.request().method(), host: u.host, path: u.pathname, status: r.status(), rows });
  });
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
      await page.goto(Routes.courseDetail()); await waitForPageLoad(page);
      await expect(page.locator('h1').first()).toBeVisible();
      await capture(page, info, vp.name, '02-course-detail', calls, {
        data: { heading: (await page.locator('h1').first().innerText()).slice(0, 120), failedApi: calls.filter((c) => c.status >= 400).map((c) => `${c.status} ${c.path}`) },
        save: 'NOT EXERCISED (read-only dispatch scope)',
      });

      calls.length = 0;
      await page.goto(Routes.admin); await waitForPageLoad(page);
      const finalPath = new URL(page.url()).pathname;
      const denied = !finalPath.startsWith('/admin');
      await capture(page, info, vp.name, '03-admin-as-member', calls, {
        permission: { requested: Routes.admin, finalPath, deniedForMember: denied },
        save: 'NOT EXERCISED (read-only dispatch scope)',
      });
      expect(denied, 'a member session must not stay on /admin').toBe(true);
    });
  });
}
