// ABOUTME: The `test` every roster-reports spec uses: the shared console-error fixture, the gradebook-owned PREVENTIVE origin
// ABOUTME: guard (reused unchanged), and the PREVENTIVE request policy (request-policy.mjs) on the same context.
import { test as base, expect } from '../fixtures/page-helpers';
import { installOriginGuard } from '../gradebook-roles/origin-guard.mjs';
import { assertStrictLocalBinding } from '../gradebook-roles/local-binding.mjs';
import { installRequestPolicy } from './request-policy.mjs';
import { actorOf, appendTelemetry } from './actors.mjs';

export const BINDING = assertStrictLocalBinding();
// Project -> actor enum for refusal diagnostics (own-key lookup; anything else is 'unknown').
const PROJECT_ACTORS: Record<string, string> = Object.assign(Object.create(null), { 'rr-instructor': 'instructor', 'rr-admin': 'admin', 'rr-learner': 'member', 'rr-error-pending': 'instructor' });
const actorOfProject = (name: string) => (Object.hasOwn(PROJECT_ACTORS, name) ? PROJECT_ACTORS[name] : 'unknown');

export const test = base.extend<{ originGuard: Array<{ origin: string; kind: string }>; requestPolicy: Array<{ method: string; resource: string; rpc: string }> }>({
  originGuard: [async ({ context }, use, testInfo) => {
    const blocked = await installOriginGuard(context, [BINDING.app.origin, BINDING.api.origin]);
    await use(blocked);
    // Fixed code with an actor enum and a count only (never an origin string): requests to non-approved origins were blocked.
    if (blocked.length) throw new Error(`RR_TEST_E_ORIGIN actor=${actorOfProject(testInfo.project.name)} count=${blocked.length}`);
  }, { auto: true }],
  // Depends on originGuard so it is installed after it and runs first for every request of the context.
  // Lifetime: OUTER to page and to every fixture that uses page, including the shared consoleErrors (see the lane page
  // override below). Its teardown therefore runs after consoleErrors has finished its page reads and assertions; it
  // then closes this test's own context (no request can start afterwards), finalizes, and consumes the result AFTER the
  // awaited close, so a late start or a sink error during console teardown or close cannot pass unseen.
  requestPolicy: [async ({ context, originGuard }, use, testInfo) => {
    void originGuard;
    const policy = await installRequestPolicy(context, BINDING.api.origin, { actorOf, onTelemetry: (r) => appendTelemetry(r) });
    try { await use(policy.forbidden); } finally {
      try { await context.close(); } finally { await policy.finalize(); }
    }
    policy.assertClosed();
    // Each refused request was aborted before it was sent; the failure names only fixed categories (forbiddenMessage).
    const refusal = policy.forbiddenReport('test', actorOfProject(testInfo.project.name));
    if (refusal) throw new Error(refusal);
  }, { auto: true }],
  // Lane-only dependency edge: page depends on requestPolicy, so requestPolicy is set up before page and torn down
  // after page and after everything that depends on page (consoleErrors). The shared console fixture is unchanged.
  page: async ({ page, requestPolicy }, provide) => {
    void requestPolicy;
    await provide(page);
  },
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
