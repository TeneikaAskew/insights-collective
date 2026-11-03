// ABOUTME: Session-only global setup for the T-15 acceptance run: signs in e2e-admin, e2e-instructor and e2e-member against
// ABOUTME: the strictly local API and saves their states in the private RR_SESSION_DIR. No seed, sweep, delete or teardown.
//
// Association (pattern of the gradebook journey setup): run.sh writes a fresh nonce into the RR course description through
// the DB DSN; the instructor must read exactly that value back through the approved API (API -> DB), and the browser must
// call only the approved API origin (app -> API). Anything else fails before any test.
import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromiumExecutableOption } from '../support/chromium-executable';
import { assertStrictLocalBinding } from '../gradebook-roles/local-binding.mjs';
import { newGuardedContext } from '../gradebook-roles/origin-guard.mjs';
import { installRequestPolicy } from './request-policy.mjs';
import { actorOf, appendTelemetry, sinkPath } from './actors.mjs';
import { RR } from './expected';
import { writePrivateFile } from '../gradebook-roles/journey/private-dir.mjs';

export const ROLES = {
  admin: 'e2e-admin@insightscollective.org',
  instructor: 'e2e-instructor@insightscollective.org',
  member: 'e2e-member@insightscollective.org',
} as const;
export type Role = keyof typeof ROLES;

/** The private session dir: absolute, a real directory (not a link), owned by this user, mode 0700. */
export function sessionDir(env = process.env): string {
  const d = env.RR_SESSION_DIR ?? '';
  if (!path.isAbsolute(d)) throw new Error('RR_SETUP_E_SESSION_DIR');
  let st: fs.Stats;
  try { st = fs.lstatSync(d); } catch { throw new Error('RR_SETUP_E_SESSION_DIR'); } // no path in the message
  if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o777) !== 0o700 || (typeof process.getuid === 'function' && st.uid !== process.getuid())) {
    throw new Error('RR_SETUP_E_SESSION_DIR');
  }
  return d;
}

// Every refusal below is a FIXED code (RR_SETUP_E_*, RR_POLICY_E_*, RR_SINK_E_*) with fixed-enum or integer fields only, so
// summary.mjs can classify it without printing input text. The first failure is kept and rethrown unchanged.
export default async function sessionSetup(_config: FullConfig): Promise<void> {
  const { api, app, anonKey } = assertStrictLocalBinding();
  const dir = sessionDir();
  const nonce = process.env.RR_ASSOCIATION_NONCE ?? '';
  sinkPath(); // the telemetry sink's fixed path and private parents must hold before any browser exists (RR_SINK_E_ROOT)
  if (!/^[0-9a-f]{32}$/.test(nonce)) throw new Error('RR_SETUP_E_NONCE');
  const password = process.env.E2E_TEST_PASSWORD ?? '';
  if (!password) throw new Error('RR_SETUP_E_PASSWORD');
  for (const [role, email] of Object.entries(ROLES) as Array<[Role, string]>) {
    const res = await fetch(`${api.origin}/auth/v1/token?grant_type=password`, {
      method: 'POST', redirect: 'error', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status !== 200) throw new Error(`RR_SETUP_E_SIGNIN actor=${role} http=${res.status}`);
    const t = await res.json();
    if (role === 'instructor') {
      const r = await fetch(`${api.origin}/rest/v1/courses?id=eq.${RR.course}&select=description`, {
        redirect: 'error', headers: { apikey: anonKey, Authorization: `Bearer ${t.access_token}` },
      });
      const rows = r.status === 200 ? await r.json() : null;
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0].description !== `rr-association:${nonce}`) {
        throw new Error(`RR_SETUP_E_ASSOCIATION actor=${role} http=${r.status}`);
      }
    }
    const value = JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, token_type: 'bearer', expires_in: t.expires_in, expires_at: Math.floor(Date.now() / 1000) + t.expires_in, user: t.user });
    const browser = await chromium.launch(chromiumExecutableOption());
    let policy: Awaited<ReturnType<typeof installRequestPolicy>> | null = null;
    let failure: unknown = null;
    try {
      const { context, blocked } = await newGuardedContext(browser, [app.origin, api.origin]);
      // Same preventive request policy as the tests, installed before any page exists.
      policy = await installRequestPolicy(context, api.origin, { actorOf, onTelemetry: (r) => appendTelemetry(r) });
      await context.addInitScript(({ v }) => { localStorage.setItem('supabase.auth.token', v); localStorage.setItem('e2e:disable-tours', '1'); }, { v: value });
      const page = await context.newPage();
      const origins = new Set<string>();
      page.on('request', (r) => { if (/\/(rest|auth|storage|functions)\/v1\//.test(r.url())) origins.add(new URL(r.url()).origin); });
      await page.goto(app.origin, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2_000);
      await policy.finalize(); // bounded; also runs in finally if anything above throws (idempotent)
      // Qualified exclusive private writer (gradebook journey private-dir.mjs, reused unchanged and pinned): O_CREAT|O_EXCL|
      // O_NOFOLLOW at 0600, fixed codes; no Playwright path write followed by an after-the-fact chmod.
      const state = await context.storageState();
      writePrivateFile(dir, `${role}.json`, JSON.stringify(state));
      if (blocked.length) throw new Error(`RR_SETUP_E_ORIGIN actor=${role} count=${blocked.length}`);
      const refusal = policy.forbiddenReport('setup', role);
      if (refusal) throw new Error(refusal);
      if ([...origins].some((o) => o !== api.origin) || !origins.has(api.origin)) throw new Error(`RR_SETUP_E_APP_API actor=${role}`);
      if (!state.origins.some((o) => o.localStorage.some((e) => e.name === 'supabase.auth.token' && e.value.includes('access_token')))) {
        throw new Error(`RR_SETUP_E_SESSION_STATE actor=${role}`);
      }
    } catch (e) { failure = e; }
    // Finalize telemetry on EVERY path (including a setup throw). Every later error is kept only when nothing failed
    // earlier, so it never replaces the first error; the browser always closes.
    try { if (policy) await policy.finalize(); } catch (e) { if (failure === null) failure = e; }
    // Setup has no shared console fixture, so the browser (and this context) closes first; only then is the result
    // consumed, so a NEW telemetry start or a sink error during storageState or the close itself fails setup.
    try { await browser.close(); } catch (e) { if (failure === null) failure = e; }
    try { policy?.assertClosed(); } catch (e) { if (failure === null) failure = e; }
    if (failure !== null) throw failure;
  }
  // stderr, never stdout: run.sh captures this process's whole stdout as the JSON reporter's report, and summary.mjs
  // parses that file whole, so any stdout line here makes the report unparseable (run 41613979959, SUMMARY_E_INPUT).
  console.error('[roster-reports setup] association proven; admin, instructor and member sessions saved');
}
