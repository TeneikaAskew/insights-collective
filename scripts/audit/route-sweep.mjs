#!/usr/bin/env node
// ABOUTME: Loads every route as every role and records the queries the page really fires.
// ABOUTME: This is the arbiter for whether a structurally-broken query actually hurts a user.
//
// replay-queries.mjs proves a query shape is invalid. It cannot prove the page
// runs it. Four of the shapes it flagged BROKEN sit behind role or tab
// conditions and never fire on load — /courses/:id/quiz-results renders fine for
// every role even though it contains a 42703 select. One (/courses/:id/progress)
// fails outright and shows "Failed to load course progress". Only the browser
// separates those two cases, so the report grades findings as:
//
//   CONFIRMED  the sweep observed the request fail on this route
//   LATENT     invalid shape in reachable code, not fired on the default path
//   DEAD       module no route can reach
//
// Usage: node scripts/audit/route-sweep.mjs   (dev server must be up)

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

// Real seeded rows — placeholders would make every page a Not Found and tell us
// nothing about the queries a working page issues.
const PARAMS = {
  ':courseId': '660e8400-e29b-41d4-a716-446655440001',
  ':moduleId': '770e8400-e29b-41d4-a716-446655440001',
  ':itemId': 'dc50f7dc-47be-4541-aae5-98375b128a08',
  ':contentItemId': 'dc50f7dc-47be-4541-aae5-98375b128a08',
  ':assignmentId': '24de9d6a-5110-4bb5-968c-5f8f6b143461',
  ':id': 'dd0e8400-e29b-41d4-a716-446655440001',
  ':studentId': '',
  ':conversationId': '',
  ':submissionId': '',
  ':rubricId': '',
  ':pageId': '',
  ':customUrl': '',
  ':slug': '',
  ':surveySlug': '',
  ':code': 'E2EMEMBERCERT',
  ':sessionId': '',
};

const ROLES = ['public', 'member', 'instructor', 'admin'];

function fill(routePath) {
  if (routePath === '*') return null;
  let out = routePath;
  for (const [param, value] of Object.entries(PARAMS)) {
    if (!out.includes(param)) continue;
    if (!value) return null;                            // no fixture — skip rather than probe a 404
    out = out.replaceAll(param, value);
  }
  return /:|\*/.test(out) ? null : out;
}

const { routes } = JSON.parse(fs.readFileSync('.e2e-audit/route-reachability.json', 'utf8'));
const targets = routes.filter((r) => !r.redirect).map((r) => ({ route: r.path, url: fill(r.path) })).filter((t) => t.url);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Sign in fresh rather than reusing .playwright-sessions/*.json.
 *
 * Those files are written by global-setup and the access tokens in them expire
 * in an hour. A sweep run against stale ones reported 401s on code_challenges
 * and enrollments for the MEMBER role and looked like a permissions defect;
 * signing in again returned 200 for both. A diagnostic that produces false
 * defects is worse than no diagnostic.
 */
async function freshSessionValue(role) {
  const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`] ?? process.env.E2E_TEST_PASSWORD;
  if (!email || !password) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const t = await res.json();
  return JSON.stringify({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    token_type: 'bearer',
    expires_in: t.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + t.expires_in,
    user: t.user,
  });
}

const browser = await chromium.launch();
const results = [];

for (const role of ROLES) {
  let session = null;
  if (role !== 'public') {
    session = await freshSessionValue(role);
    if (!session) {
      console.error(`skipping ${role}: could not sign in (set E2E_${role.toUpperCase()}_EMAIL / _PASSWORD)`);
      continue;
    }
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (session) {
    await context.addInitScript(
      ({ value }) => {
        localStorage.setItem('supabase.auth.token', value);
        localStorage.setItem('e2e:disable-tours', '1');
      },
      { value: session },
    );
  }

  for (const { route, url } of targets) {
    const page = await context.newPage();
    const failed = [];
    const consoleErrors = [];
    page.on('response', (r) => {
      if (r.status() < 400) return;
      const u = r.url();
      if (!/\/(rest|rpc|functions|storage)\/v1\//.test(u)) return;
      failed.push({ status: r.status(), url: decodeURIComponent(u).split('/v1/')[1].slice(0, 220) });
    });
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

    let landed = url;
    let body = '';
    try {
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 25_000 });
      await page.waitForTimeout(1200);
      landed = new URL(page.url()).pathname;
      body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
    } catch (e) {
      body = `NAVIGATION ERROR: ${e.message.slice(0, 160)}`;
    }

    const brokenState = /failed to load|unexpected error|something went wrong|not found|404/i.test(body);
    results.push({ role, route, url, landed, redirected: landed !== url, brokenState, failed, consoleErrors, body });
    await page.close();
  }
  await context.close();
  console.error(`swept ${targets.length} routes as ${role}`);
}

await browser.close();
fs.writeFileSync('.e2e-audit/route-sweep.json', JSON.stringify({ results }, null, 2));

const withFailures = results.filter((r) => r.failed.length);
console.error(`\n${results.length} route/role loads; ${withFailures.length} issued a failing request`);
for (const r of withFailures) {
  console.error(`  [${r.role}] ${r.route}`);
  for (const f of r.failed.slice(0, 2)) console.error(`      ${f.status} ${f.url}`);
}
console.error('→ .e2e-audit/route-sweep.json');
