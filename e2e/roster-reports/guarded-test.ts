// ABOUTME: The `test` every roster-reports spec uses: the shared console-error fixture, the gradebook-owned PREVENTIVE origin
// ABOUTME: guard (reused unchanged), and the PREVENTIVE request policy (request-policy.mjs) on the same context.
import { test as base, expect } from '../fixtures/page-helpers';
import { installOriginGuard } from '../gradebook-roles/origin-guard.mjs';
import { assertStrictLocalBinding } from '../gradebook-roles/local-binding.mjs';
import { installRequestPolicy } from './request-policy.mjs';
import { actorOf, appendTelemetry } from './actors.mjs';

export const BINDING = assertStrictLocalBinding();

export const test = base.extend<{ originGuard: Array<{ origin: string; kind: string }>; requestPolicy: string[] }>({
  originGuard: [async ({ context }, use) => {
    const blocked = await installOriginGuard(context, [BINDING.app.origin, BINDING.api.origin]);
    await use(blocked);
    expect(blocked, 'requests to non-approved origins (each was blocked before it was sent)').toEqual([]);
  }, { auto: true }],
  // Depends on originGuard so it is installed after it and runs first for every request of the context.
  requestPolicy: [async ({ context, originGuard }, use) => {
    void originGuard;
    const { forbidden, drain } = await installRequestPolicy(context, BINDING.api.origin, { actorOf, onTelemetry: (r) => appendTelemetry(r) });
    await use(forbidden);
    await drain();
    expect(forbidden, 'forbidden API requests (each was aborted before it was sent)').toEqual([]);
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
