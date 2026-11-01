// ABOUTME: Session-only global setup for the gradebook real-role run: signs e2e-instructor and e2e-member in against the
// ABOUTME: strictly local API and saves their storage states. Nothing else: no password bootstrap, no seed check, no sweeps,
// ABOUTME: no deletes, and no teardown exists. Binding is re-checked here before the first request.
import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromiumExecutableOption } from '../support/chromium-executable';
import { assertStrictLocalBinding } from './local-binding.mjs';

export const GB_SESSIONS = path.join(process.cwd(), '.playwright-sessions', 'gradebook-roles');
const ROLES = {
  instructor: { email: 'e2e-instructor@insightscollective.org', password: () => process.env.E2E_INSTRUCTOR_PASSWORD || process.env.E2E_TEST_PASSWORD || '' },
  member: { email: 'e2e-member@insightscollective.org', password: () => process.env.E2E_MEMBER_PASSWORD || process.env.E2E_TEST_PASSWORD || '' },
} as const;

export default async function sessionSetup(_config: FullConfig): Promise<void> {
  const { api, app, anonKey } = assertStrictLocalBinding();
  fs.mkdirSync(GB_SESSIONS, { recursive: true, mode: 0o700 });
  for (const [role, who] of Object.entries(ROLES)) {
    const password = who.password();
    if (!password) throw new Error(`gradebook-roles setup: no password for ${role}`);
    const res = await fetch(`${api.origin}/auth/v1/token?grant_type=password`, {
      method: 'POST', redirect: 'error',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: who.email, password }),
    });
    if (res.status !== 200) throw new Error(`gradebook-roles setup: sign-in for ${role} returned HTTP ${res.status}`);
    const t = await res.json();
    const value = JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, token_type: 'bearer', expires_in: t.expires_in, expires_at: Math.floor(Date.now() / 1000) + t.expires_in, user: t.user });
    const browser = await chromium.launch(chromiumExecutableOption());
    try {
      const context = await browser.newContext();
      await context.addInitScript(({ v }) => { localStorage.setItem('supabase.auth.token', v); localStorage.setItem('e2e:disable-tours', '1'); }, { v: value });
      const page = await context.newPage();
      const origins = new Set<string>();
      page.on('request', (r) => { if (/\/(rest|auth|storage|functions)\/v1\//.test(r.url())) origins.add(new URL(r.url()).origin); });
      await page.goto(app.origin, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2_000);
      const state = await context.storageState({ path: path.join(GB_SESSIONS, `${role}.json`) });
      const foreign = [...origins].filter((o) => o !== api.origin);
      if (foreign.length) throw new Error(`gradebook-roles setup: the app at ${app.origin} called ${foreign.length} non-local API origin(s)`);
      if (!state.origins.some((o) => o.localStorage.some((e) => e.name === 'supabase.auth.token' && e.value.includes('access_token')))) {
        throw new Error(`gradebook-roles setup: ${role} session was not persisted by the app`);
      }
      console.log(`[gradebook-roles setup] session saved for ${role}`);
    } finally { await browser.close(); }
  }
}
