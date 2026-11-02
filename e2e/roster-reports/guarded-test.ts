// ABOUTME: The `test` every roster-reports spec uses: the shared console-error fixture, the gradebook-owned origin guard
// ABOUTME: (reused unchanged), and a read-only guard that fails the test if the page sends any non-GET API request.
import { test as base, expect } from '../fixtures/page-helpers';
import { installOriginGuard } from '../gradebook-roles/origin-guard.mjs';
import { assertStrictLocalBinding } from '../gradebook-roles/local-binding.mjs';

export const BINDING = assertStrictLocalBinding();

export const test = base.extend<{ originGuard: Array<{ origin: string; kind: string }>; readOnly: string[] }>({
  originGuard: [async ({ context }, use) => {
    const blocked = await installOriginGuard(context, [BINDING.app.origin, BINDING.api.origin]);
    await use(blocked);
    expect(blocked, 'requests to non-approved origins (each was blocked before it was sent)').toEqual([]);
  }, { auto: true }],
  readOnly: [async ({ page }, use) => {
    const writes: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      // Token refresh is the only POST the app may make; any data write fails the test.
      if (u.origin === BINDING.api.origin && r.method() !== 'GET' && r.method() !== 'HEAD' && r.method() !== 'OPTIONS'
        && !u.pathname.startsWith('/auth/v1/token')) writes.push(`${r.method()} ${u.pathname}`);
    });
    await use(writes);
    expect(writes, 'the Students and Reports tabs must not write').toEqual([]);
  }, { auto: true }],
});
export { expect };

/** GET a PostgREST path with the page's own signed-in token (no retries, no redirects). */
export async function apiAsPage(page: import('@playwright/test').Page, pathAndQuery: string) {
  const token = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('supabase.auth.token') || 'null')?.access_token ?? null; } catch { return null; }
  });
  expect(token, 'signed-in session on the page').toBeTruthy();
  const r = await page.request.get(`${BINDING.api.origin}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: BINDING.anonKey, Authorization: `Bearer ${token}` }, maxRedirects: 0,
  });
  expect(r.status(), `GET ${pathAndQuery.split('?')[0]}`).toBe(200);
  return (await r.json()) as Array<Record<string, unknown>>;
}
