// ABOUTME: Shared ids and helpers for the gradebook real-role run (scripts/gradebook-fixture/seed.sql). API probes reuse
// ABOUTME: the signed-in page's own session token against the configured LOOPBACK API only; anything else refuses.
import type { Page, TestInfo } from '@playwright/test';

export const GB = {
  course: '9b6b0000-0000-4000-8000-000000000001',
  module: '9b6b0000-0000-4000-8000-000000000002',
  item: { SG0: '9b6b0000-0000-4000-8000-000000000101', SG7: '9b6b0000-0000-4000-8000-000000000102', GB0: '9b6b0000-0000-4000-8000-000000000103', GB7: '9b6b0000-0000-4000-8000-000000000104' },
  sub: { SG0: '9b6b0000-0000-4000-8000-000000000301', SG7: '9b6b0000-0000-4000-8000-000000000302', GB0: '9b6b0000-0000-4000-8000-000000000303', GB7: '9b6b0000-0000-4000-8000-000000000304', GX_MEMBER: '9b6b0000-0000-4000-8000-000000000311', GX_ADMIN: '9b6b0000-0000-4000-8000-000000000312' },
  memberId: 'e2e00000-0000-4000-8000-000000000003',
};
// Synthetic feedback strings; the witness stores only their md5.
export const FEEDBACK = { SG0a: 'GB fixture: thesis missing.', SG0b: 'GB fixture: thesis missing; see rubric row 1.', SG7: 'GB fixture: solid argument.' };

const API = (() => { try { return new URL(process.env.VITE_SUPABASE_URL || ''); } catch { return null; } })();
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const API_OK = Boolean(API && API.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(API.hostname) && API.port && ANON);

/** Classes, exactly as the plan defines them. Anything else is INVALID and fails the test. */
export type WriteClass = 'saved' | 'pinned-unchanged' | 'zero-row';

/** PATCH one submission as the page's signed-in user, return=representation, and classify. No retries, no redirects. */
export async function patchAsPage(page: Page, submissionId: string, body: Record<string, unknown>) {
  if (!API_OK || !API) throw new Error('gradebook fixture refused: VITE_SUPABASE_URL is not a loopback http origin with a port, or no anon key');
  const token = await page.evaluate(() => {
    try { const v = JSON.parse(localStorage.getItem('supabase.auth.token') || 'null'); return v?.access_token || v?.currentSession?.access_token || null; } catch { return null; }
  });
  if (!token) throw new Error('gradebook fixture INVALID: no signed-in session on the page');
  const r = await page.request.patch(`${API.origin}/rest/v1/assignment_submissions?id=eq.${submissionId}&select=id,grade,grader_comments,workflow_state`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    data: body, maxRedirects: 0,
  });
  const status = r.status();
  const rows = status >= 200 && status < 300 ? ((await r.json()) as Array<Record<string, unknown>>) : null;
  return { status, rows };
}

export async function shot(page: Page, info: TestInfo, name: string) {
  await info.attach(`${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
