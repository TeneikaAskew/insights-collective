// ABOUTME: Session-only global setup for the builder-authoring lane (UNRUN). Fail-closed order: strict local binding, fresh
// ABOUTME: private BA_SESSION_DIR, the pairing proof plus a LIVE anon API recheck, and only then the e2e-instructor sign-in.
// Reuses the gradebook journey's private-dir, origin-guard and pairing-proof modules unchanged. No seed, sweep, delete or
// teardown. Every failure is a fixed BA_SETUP_E_* (or the reused modules' JOURNEY_*) code; raw errors are dropped.
import { chromium, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromiumExecutableOption } from '../support/chromium-executable';
import { assertStrictLocalBinding } from '../gradebook-roles/local-binding.mjs';
import { newGuardedContext } from '../gradebook-roles/origin-guard.mjs';
import { assertPrivateSessionDir, writePrivateFile, JourneyGateError } from '../gradebook-roles/journey/private-dir.mjs';
import { assertPairingProof, assertLivePairing } from '../gradebook-roles/journey/pairing-proof.mjs';
import { INSTRUCTOR_ID } from './ids';

const EMAIL = 'e2e-instructor@insightscollective.org';

async function stage<T>(code: string, fn: () => T | Promise<T>): Promise<T> {
  try { return await fn(); } catch (err) {
    if (err instanceof JourneyGateError) throw err;
    throw new JourneyGateError(code);
  }
}

export default async function builderAuthoringSetup(_config: FullConfig): Promise<void> {
  const { api, app, anonKey } = await stage('BA_SETUP_E_BINDING', () => assertStrictLocalBinding());
  const dir = assertPrivateSessionDir(process.env.BA_SESSION_DIR);
  // The API the browser will use serves THIS run's carrier right now, written through the DSN the seed used.
  const proof = assertPairingProof(process.env.BA_PAIRING_PROOF, { sessionDir: dir });
  await assertLivePairing(proof, { apiOrigin: api.origin, anonKey, randomId: randomUUID() });

  const password = process.env.E2E_INSTRUCTOR_PASSWORD || '';
  if (!password) throw new JourneyGateError('BA_SETUP_E_NO_PASSWORD');
  const res = await stage('BA_SETUP_E_SIGNIN_TRANSPORT', () => fetch(`${api.origin}/auth/v1/token?grant_type=password`, {
    method: 'POST', redirect: 'error',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password }),
  }));
  if (res.status !== 200) throw new JourneyGateError('BA_SETUP_E_SIGNIN_HTTP');
  const t: any = await stage('BA_SETUP_E_SIGNIN_PARSE', () => res.json());
  if (!t?.access_token || t?.user?.id !== INSTRUCTOR_ID) throw new JourneyGateError('BA_SETUP_E_SIGNIN_SHAPE');
  const value = JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, token_type: 'bearer', expires_in: t.expires_in, expires_at: Math.floor(Date.now() / 1000) + t.expires_in, user: t.user });

  const browser = await stage('BA_SETUP_E_BROWSER_LAUNCH', () => chromium.launch(chromiumExecutableOption()));
  let primary: unknown = null;
  try {
    const { context, blocked } = await stage('BA_SETUP_E_CONTEXT', () => newGuardedContext(browser, [app.origin, api.origin]));
    await stage('BA_SETUP_E_INIT_SCRIPT', () => context.addInitScript(({ v }) => { localStorage.setItem('supabase.auth.token', v); localStorage.setItem('e2e:disable-tours', '1'); }, { v: value }));
    const page = await stage('BA_SETUP_E_PAGE', () => context.newPage());
    await stage('BA_SETUP_E_GOTO', () => page.goto(app.origin, { waitUntil: 'domcontentloaded' }));
    await stage('BA_SETUP_E_SETTLE', () => page.waitForTimeout(2_000));
    if (blocked.length) throw new JourneyGateError('BA_SETUP_E_FOREIGN_ORIGIN');
    const state = await stage('BA_SETUP_E_STORAGE_STATE', () => context.storageState());
    writePrivateFile(dir, 'instructor.json', JSON.stringify(state));
  } catch (err) { primary = err; }
  let closeFailed = false;
  try { await browser.close(); } catch { closeFailed = true; }
  if (primary) throw primary instanceof JourneyGateError ? primary : new JourneyGateError('BA_SETUP_E_UNCLASSIFIED');
  if (closeFailed) throw new JourneyGateError('BA_SETUP_E_BROWSER_CLOSE');
  const left = await stage('BA_SETUP_E_SESSION_DIR_LIST', () => fs.readdirSync(dir).sort().join(','));
  if (left !== 'instructor.json') throw new JourneyGateError('BA_SETUP_E_SESSION_DIR_CONTENT');
}
