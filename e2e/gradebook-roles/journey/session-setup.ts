// ABOUTME: Session-only global setup for the journey lane (UNRUN proposal). Fail-closed order: strict local binding,
// ABOUTME: gate 1 private session dir, gate 3 pre-seed pairing proof; only then sign in e2e-instructor and e2e-member.
//
// No password bootstrap, no seed, no sweep, no delete, no teardown. Errors are fixed codes plus at most an HTTP status
// number: never a body, URL, token, password or exception text. Session files are created exclusively with mode 0600.
import { chromium, type FullConfig } from '@playwright/test';
import { chromiumExecutableOption } from '../../support/chromium-executable';
import { assertStrictLocalBinding } from '../local-binding.mjs';
import { newGuardedContext } from '../origin-guard.mjs';
import { assertPrivateSessionDir, writePrivateFile, JourneyGateError } from './private-dir.mjs';
import { assertPairingProof } from './pairing-proof.mjs';

const ROLES = {
  instructor: { email: 'e2e-instructor@insightscollective.org', env: 'E2E_INSTRUCTOR_PASSWORD' },
  member: { email: 'e2e-member@insightscollective.org', env: 'E2E_MEMBER_PASSWORD' },
} as const;

export default async function journeySessionSetup(_config: FullConfig): Promise<void> {
  const { api, app, anonKey } = assertStrictLocalBinding();
  // Gate 1: the dir must be fresh, private and empty BEFORE anything is written into it.
  const dir = assertPrivateSessionDir(process.env.GB_SESSION_DIR);
  // Gate 3: the pairing proof must already exist (written before the seed). Its producer is the shared runner's.
  assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF);

  for (const [role, who] of Object.entries(ROLES)) {
    const password = process.env[who.env] || '';
    if (!password) throw new JourneyGateError(`JOURNEY_SETUP_E_NO_PASSWORD_${role.toUpperCase()}`);
    let res: Response;
    try {
      res = await fetch(`${api.origin}/auth/v1/token?grant_type=password`, {
        method: 'POST', redirect: 'error',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: who.email, password }),
      });
    } catch { throw new JourneyGateError(`JOURNEY_SETUP_E_SIGNIN_TRANSPORT_${role.toUpperCase()}`); }
    if (res.status !== 200) throw new JourneyGateError(`JOURNEY_SETUP_E_SIGNIN_HTTP_${res.status}_${role.toUpperCase()}`);
    let t: any;
    try { t = await res.json(); } catch { throw new JourneyGateError(`JOURNEY_SETUP_E_SIGNIN_PARSE_${role.toUpperCase()}`); }
    if (!t?.access_token || !t?.user?.id) throw new JourneyGateError(`JOURNEY_SETUP_E_SIGNIN_SHAPE_${role.toUpperCase()}`);

    const value = JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, token_type: 'bearer', expires_in: t.expires_in, expires_at: Math.floor(Date.now() / 1000) + t.expires_in, user: t.user });
    const browser = await chromium.launch(chromiumExecutableOption());
    try {
      const { context, blocked } = await newGuardedContext(browser, [app.origin, api.origin]);
      await context.addInitScript(({ v }) => { localStorage.setItem('supabase.auth.token', v); localStorage.setItem('e2e:disable-tours', '1'); }, { v: value });
      const page = await context.newPage();
      const origins = new Set<string>();
      page.on('request', (r) => { if (/\/(rest|auth|storage|functions)\/v1\//.test(r.url())) origins.add(new URL(r.url()).origin); });
      await page.goto(app.origin, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2_000);
      const state = await context.storageState();
      if (blocked.length) throw new JourneyGateError('JOURNEY_SETUP_E_FOREIGN_ORIGIN_BLOCKED');
      if ([...origins].some((o) => o !== api.origin)) throw new JourneyGateError('JOURNEY_SETUP_E_FOREIGN_API');
      if (!origins.has(api.origin)) throw new JourneyGateError('JOURNEY_SETUP_E_APP_NEVER_CALLED_API');
      if (!state.origins.some((o) => o.localStorage.some((e) => e.name === 'supabase.auth.token' && e.value.includes('access_token')))) {
        throw new JourneyGateError(`JOURNEY_SETUP_E_SESSION_NOT_PERSISTED_${role.toUpperCase()}`);
      }
      writePrivateFile(dir, `${role}.json`, JSON.stringify(state));
      console.log(`[journey setup] session saved for ${role}`);
    } finally { await browser.close(); }
  }
}
