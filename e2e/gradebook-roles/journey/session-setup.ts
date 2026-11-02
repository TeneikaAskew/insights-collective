// ABOUTME: Session-only global setup for the journey lane (UNRUN proposal). Fail-closed order: strict local binding, gate 1
// ABOUTME: private session dir, composition, gate 3 proof v2 + live API recheck; only then sign in e2e-instructor and e2e-member.
//
// Error boundary: every step runs inside stage(code, fn). A JourneyGateError passes through unchanged; ANY other failure
// (launch, context, addInitScript, goto, storageState, fs write/chmod, JSON, fetch, browser.close) becomes that step's
// fixed code. Raw diagnostics never reach stdout/stderr: they go only to GB_DIAG_DIR (a separate private 0700 dir,
// 0600 files) when that is set, and are dropped otherwise. A cleanup (browser.close) failure never masks the first error.
// No password bootstrap, no seed, no sweep, no delete, no teardown.
import { chromium, type Browser, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import { chromiumExecutableOption } from '../../support/chromium-executable';
import { assertStrictLocalBinding } from '../local-binding.mjs';
import { newGuardedContext } from '../origin-guard.mjs';
import { assertPrivateSessionDir, assertPrivateDir, writePrivateFile, JourneyGateError } from './private-dir.mjs';
import { assertPairingProof, assertLivePairing } from './pairing-proof.mjs';
import { randomUUID } from 'node:crypto';

const ROLES = {
  instructor: { email: 'e2e-instructor@insightscollective.org', env: 'E2E_INSTRUCTOR_PASSWORD' },
  member: { email: 'e2e-member@insightscollective.org', env: 'E2E_MEMBER_PASSWORD' },
} as const;

let diagDir: string | null = null;
let diagN = 0;
function privateDiag(code: string, err: unknown) {
  if (!diagDir) return;
  try {
    const e = err as { name?: unknown; message?: unknown };
    writePrivateFile(diagDir, `diag-${String(++diagN).padStart(3, '0')}.json`, JSON.stringify({ code, name: String(e?.name ?? ''), message: String(e?.message ?? '') }));
  } catch { /* diagnostics are best effort and never change the outcome */ }
}

async function stage<T>(code: string, fn: () => T | Promise<T>): Promise<T> {
  try { return await fn(); } catch (err) {
    if (err instanceof JourneyGateError) throw err;
    privateDiag(code, err);
    throw new JourneyGateError(code);
  }
}

export default async function journeySessionSetup(_config: FullConfig): Promise<void> {
  try {
    await run();
  } catch (err) {
    if (err instanceof JourneyGateError) throw err;
    privateDiag('JOURNEY_SETUP_E_UNCLASSIFIED', err);
    throw new JourneyGateError('JOURNEY_SETUP_E_UNCLASSIFIED');
  }
}

async function run(): Promise<void> {
  const { api, app, anonKey } = await stage('JOURNEY_SETUP_E_BINDING', () => assertStrictLocalBinding());
  // Gate 1: the session dir must be fresh, private and empty BEFORE anything is written into it.
  const dir = assertPrivateSessionDir(process.env.GB_SESSION_DIR);
  // Optional private diagnostics dir: its own fresh 0700 dir, never the session dir.
  if (process.env.GB_DIAG_DIR) {
    const d = assertPrivateDir(process.env.GB_DIAG_DIR, { gate: 'JOURNEY_GATE2' });
    if (d === dir) throw new JourneyGateError('JOURNEY_GATE2_E_SAME_AS_SESSION_DIR');
    diagDir = d;
  }
  // composed-r5 (T-09 000500 + 000600 applied) is the required acceptance target. The certificate-before-grade positive also
  // passes on the baseline issuer, so it does not prove r5; r5 adds the final-evidence safeguards. The runner must export
  // what scripts/gradebook-fixture/composition.sql detected; anything else refuses.
  if (process.env.GB_COMPOSITION !== 'composed-r5') throw new JourneyGateError('JOURNEY_SETUP_E_COMPOSITION_NOT_R5');
  // Gate 3, before the first POST: proof v2 shape and placement, then a LIVE anon re-read of the carrier row through the
  // same API origin the browser uses (see pairing-proof.mjs). Stack ownership itself is the runner's D1 gate.
  const proof = assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF, { sessionDir: dir });
  await assertLivePairing(proof, { apiOrigin: api.origin, anonKey, randomId: randomUUID() });

  for (const [role, who] of Object.entries(ROLES)) {
    const R = role.toUpperCase();
    const password = process.env[who.env] || '';
    if (!password) throw new JourneyGateError(`JOURNEY_SETUP_E_NO_PASSWORD_${R}`);
    const res = await stage(`JOURNEY_SETUP_E_SIGNIN_TRANSPORT_${R}`, () => fetch(`${api.origin}/auth/v1/token?grant_type=password`, {
      method: 'POST', redirect: 'error',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: who.email, password }),
    }));
    if (res.status !== 200) throw new JourneyGateError(`JOURNEY_SETUP_E_SIGNIN_HTTP_${res.status}_${R}`);
    const t: any = await stage(`JOURNEY_SETUP_E_SIGNIN_PARSE_${R}`, () => res.json());
    if (!t?.access_token || !t?.user?.id) throw new JourneyGateError(`JOURNEY_SETUP_E_SIGNIN_SHAPE_${R}`);
    const value = await stage(`JOURNEY_SETUP_E_SESSION_SERIALIZE_${R}`, () => JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, token_type: 'bearer', expires_in: t.expires_in, expires_at: Math.floor(Date.now() / 1000) + t.expires_in, user: t.user }));

    const browser: Browser = await stage(`JOURNEY_SETUP_E_BROWSER_LAUNCH_${R}`, () => chromium.launch(chromiumExecutableOption()));
    let primary: unknown = null;
    try {
      const { context, blocked } = await stage(`JOURNEY_SETUP_E_CONTEXT_${R}`, () => newGuardedContext(browser, [app.origin, api.origin]));
      await stage(`JOURNEY_SETUP_E_INIT_SCRIPT_${R}`, () => context.addInitScript(({ v }) => { localStorage.setItem('supabase.auth.token', v); localStorage.setItem('e2e:disable-tours', '1'); }, { v: value }));
      const page = await stage(`JOURNEY_SETUP_E_PAGE_${R}`, () => context.newPage());
      const origins = new Set<string>();
      page.on('request', (r) => { try { if (/\/(rest|auth|storage|functions)\/v1\//.test(r.url())) origins.add(new URL(r.url()).origin); } catch { origins.add('unparsable'); } });
      await stage(`JOURNEY_SETUP_E_GOTO_${R}`, () => page.goto(app.origin, { waitUntil: 'domcontentloaded' }));
      await stage(`JOURNEY_SETUP_E_SETTLE_${R}`, () => page.waitForTimeout(2_000));
      const state = await stage(`JOURNEY_SETUP_E_STORAGE_STATE_${R}`, () => context.storageState());
      if (blocked.length) throw new JourneyGateError('JOURNEY_SETUP_E_FOREIGN_ORIGIN_BLOCKED');
      if ([...origins].some((o) => o !== api.origin)) throw new JourneyGateError('JOURNEY_SETUP_E_FOREIGN_API');
      if (!origins.has(api.origin)) throw new JourneyGateError('JOURNEY_SETUP_E_APP_NEVER_CALLED_API');
      if (!state.origins.some((o) => o.localStorage.some((e) => e.name === 'supabase.auth.token' && e.value.includes('access_token')))) {
        throw new JourneyGateError(`JOURNEY_SETUP_E_SESSION_NOT_PERSISTED_${R}`);
      }
      const json = await stage(`JOURNEY_SETUP_E_STATE_SERIALIZE_${R}`, () => JSON.stringify(state));
      writePrivateFile(dir, `${role}.json`, json);
      await stage(`JOURNEY_SETUP_E_STDOUT_${R}`, () => { process.stdout.write(`[journey setup] session saved for ${role}\n`); });
    } catch (err) {
      primary = err;
    }
    // Always close, then report: the first error wins; a close failure is reported only when nothing failed before it.
    let closeFailed = false;
    try { await browser.close(); } catch (closeErr) { closeFailed = true; privateDiag(`JOURNEY_SETUP_E_BROWSER_CLOSE_${R}`, closeErr); }
    if (primary) throw primary;
    if (closeFailed) throw new JourneyGateError(`JOURNEY_SETUP_E_BROWSER_CLOSE_${R}`);
  }
  // Nothing beyond the two session files may exist in the session dir after setup.
  const left = await stage('JOURNEY_SETUP_E_SESSION_DIR_LIST', () => fs.readdirSync(dir).sort().join(','));
  if (left !== 'instructor.json,member.json') throw new JourneyGateError('JOURNEY_SETUP_E_SESSION_DIR_CONTENT');
}
