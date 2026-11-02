// ABOUTME: Session-only global setup for the builder-authoring lane (UNRUN). Fail-closed order: strict local binding,
// ABOUTME: fresh private BA_SESSION_DIR, then sign in e2e-instructor through the loopback API and save its storage state.
// Reuses the gradebook journey's private-dir and origin-guard modules unchanged. No seed, no sweep, no delete, no teardown.
import { chromium, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import { chromiumExecutableOption } from '../support/chromium-executable';
import { assertStrictLocalBinding } from '../gradebook-roles/local-binding.mjs';
import { newGuardedContext } from '../gradebook-roles/origin-guard.mjs';
import { assertPrivateSessionDir, writePrivateFile, JourneyGateError } from '../gradebook-roles/journey/private-dir.mjs';

const INSTRUCTOR = { email: 'e2e-instructor@insightscollective.org', env: 'E2E_INSTRUCTOR_PASSWORD' } as const;

export default async function builderAuthoringSetup(_config: FullConfig): Promise<void> {
  const { api, app, anonKey } = assertStrictLocalBinding();
  const dir = assertPrivateSessionDir(process.env.BA_SESSION_DIR);
  const password = process.env[INSTRUCTOR.env] || '';
  if (!password) throw new JourneyGateError('BA_SETUP_E_NO_PASSWORD');
  const res = await fetch(`${api.origin}/auth/v1/token?grant_type=password`, {
    method: 'POST', redirect: 'error',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: INSTRUCTOR.email, password }),
  }).catch(() => { throw new JourneyGateError('BA_SETUP_E_SIGNIN_TRANSPORT'); });
  if (res.status !== 200) throw new JourneyGateError(`BA_SETUP_E_SIGNIN_HTTP_${res.status}`);
  const t: any = await res.json().catch(() => { throw new JourneyGateError('BA_SETUP_E_SIGNIN_PARSE'); });
  if (!t?.access_token || t?.user?.id !== 'e2e00000-0000-4000-8000-000000000002') throw new JourneyGateError('BA_SETUP_E_SIGNIN_SHAPE');
  const value = JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, token_type: 'bearer', expires_in: t.expires_in, expires_at: Math.floor(Date.now() / 1000) + t.expires_in, user: t.user });

  const browser = await chromium.launch(chromiumExecutableOption());
  try {
    const { context, blocked } = await newGuardedContext(browser, [app.origin, api.origin]);
    await context.addInitScript(({ v }) => { localStorage.setItem('supabase.auth.token', v); localStorage.setItem('e2e:disable-tours', '1'); }, { v: value });
    const page = await context.newPage();
    await page.goto(app.origin, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    if (blocked.length) throw new JourneyGateError('BA_SETUP_E_FOREIGN_ORIGIN');
    writePrivateFile(dir, 'instructor.json', JSON.stringify(await context.storageState()));
  } finally {
    await browser.close().catch(() => undefined);
  }
  if (fs.readdirSync(dir).sort().join(',') !== 'instructor.json') throw new JourneyGateError('BA_SETUP_E_SESSION_DIR_CONTENT');
}
