// ABOUTME: Shared ids, exact oracles and helpers for the gradebook real-role run (scripts/gradebook-fixture/seed.sql). API
// ABOUTME: probes use the signed-in page's own token against the strictly local API only (local-binding.mjs).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, type Page, type Request, type Response, type TestInfo } from '@playwright/test';
import { assertStrictLocalBinding } from './local-binding.mjs';

export const GB = {
  course: '9b6b0000-0000-4000-8000-000000000001',
  module: '9b6b0000-0000-4000-8000-000000000002',
  item: { SG0: '9b6b0000-0000-4000-8000-000000000101', SG7: '9b6b0000-0000-4000-8000-000000000102', GB0: '9b6b0000-0000-4000-8000-000000000103', GB7: '9b6b0000-0000-4000-8000-000000000104' },
  sub: { SG0: '9b6b0000-0000-4000-8000-000000000301', SG7: '9b6b0000-0000-4000-8000-000000000302', GB0: '9b6b0000-0000-4000-8000-000000000303', GB7: '9b6b0000-0000-4000-8000-000000000304', GX_MEMBER: '9b6b0000-0000-4000-8000-000000000311', GX_ADMIN: '9b6b0000-0000-4000-8000-000000000312' },
  title: { SG0: 'Points SG0', SG7: 'Points SG7', GB0: 'Points GB0', GB7: 'Points GB7' },
  memberId: 'e2e00000-0000-4000-8000-000000000003',
};
/** The exact final grade per assignment, and the course totals they imply: 0+7+0+7 = 14 of 4 x 10 = 40, i.e. 35%. */
export const FINAL = { SG0: 0, SG7: 7, GB0: 0, GB7: 7 } as const;
export const TOTAL = { earned: 14, possible: 40, pct: 35 } as const;
// Typed feedback, and the EXACT stored value the editor must produce for a single plain paragraph (the oracle; run.sh
// hashes these literals independently of anything the run stores).
export const FEEDBACK = { SG0a: 'GB fixture: thesis missing.', SG0b: 'GB fixture: thesis missing; see rubric row 1.', SG7: 'GB fixture: solid argument.' };
export const STORED = (text: string) => `<p>${text}</p>`;

export const BINDING = assertStrictLocalBinding();

/** A finite number from a non-null, non-empty value; anything else fails (never Number(null) === 0). */
export function num(v: unknown, what: string): number {
  expect(v === null || v === undefined || v === '', `${what} must be present, got ${JSON.stringify(v)}`).toBe(false);
  const n = typeof v === 'number' ? v : Number(v);
  expect(Number.isFinite(n), `${what} must be numeric`).toBe(true);
  return n;
}
export const sameInstant = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && Date.parse(a) === Date.parse(b) && Number.isFinite(Date.parse(a));

export async function pageToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    try { const v = JSON.parse(localStorage.getItem('supabase.auth.token') || 'null'); return v?.access_token || null; } catch { return null; }
  });
  expect(token, 'signed-in session on the page').toBeTruthy();
  return token as string;
}
/** Another role's access token, read from its saved storage state (used only to substitute a request's Authorization). */
export function savedToken(role: 'member' | 'instructor'): string {
  const st = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.playwright-sessions', 'gradebook-roles', `${role}.json`), 'utf8'));
  const e = st.origins.flatMap((o: any) => o.localStorage).find((x: any) => x.name === 'supabase.auth.token');
  const t = JSON.parse(e?.value ?? 'null')?.access_token;
  if (!t) throw new Error(`no saved ${role} token`);
  return t;
}

export type Patched = { status: number; rows: Array<Record<string, unknown>> | null };
/** PATCH one submission as the page's signed-in user, return=representation. No retries, no redirects. */
export async function patchAsPage(page: Page, submissionId: string, body: Record<string, unknown>): Promise<Patched> {
  const r = await page.request.patch(`${BINDING.api.origin}/rest/v1/assignment_submissions?id=eq.${submissionId}&select=id,grade,grader_comments,workflow_state,graded_at`, {
    headers: { Authorization: `Bearer ${await pageToken(page)}`, apikey: BINDING.anonKey, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    data: body, maxRedirects: 0,
  });
  const status = r.status();
  return { status, rows: status >= 200 && status < 300 ? await r.json() : null };
}
/** Read one submission as the page's user (for before/after comparison in API controls). */
export async function readAsPage(page: Page, submissionId: string) {
  const r = await page.request.get(`${BINDING.api.origin}/rest/v1/assignment_submissions?id=eq.${submissionId}&select=id,grade,grader_comments,workflow_state,graded_at`, {
    headers: { Authorization: `Bearer ${await pageToken(page)}`, apikey: BINDING.anonKey }, maxRedirects: 0,
  });
  expect(r.status()).toBe(200);
  const rows = await r.json();
  expect(rows).toHaveLength(1);
  return rows[0] as Record<string, unknown>;
}

export const isPatchTo = (sub: string) => (r: Response | Request) => {
  const req = 'request' in r ? r.request() : r;
  return req.method() === 'PATCH' && req.url().startsWith(`${BINDING.api.origin}/rest/v1/assignment_submissions`) && req.url().includes(`id=eq.${sub}`);
};

export async function shot(page: Page, info: TestInfo, name: string) {
  await info.attach(`${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
