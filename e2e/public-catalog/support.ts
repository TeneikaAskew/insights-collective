// ABOUTME: Shared fixture for the anonymous public-catalog specs on top of the qualified lesson-editor egress boundary (imported
// ABOUTME: as-is, blob-pinned): fails on any foreign attempt and on page errors, and exposes the API's real course responses.
import type { Page, Response } from '@playwright/test';
import { test as boundaryTest, expect } from '../lesson-editor/egress-test';
// @ts-expect-error: plain ESM data module without type declarations
import { COURSES, MODULES } from '../../scripts/public-catalog-fixture/fixtures.mjs';
// @ts-expect-error: plain ESM helper without type declarations
import { loadProvenance, expectedHash, sha256 } from '../../scripts/public-catalog-fixture/served-provenance.mjs';

export type FixtureCourse = { id: string; title: string; category: string; estimated_hours: number | null; duration: number | null; published: boolean; status: string; created_at: string; visibility: string };
export const FIXTURE: FixtureCourse[] = COURSES;
export const FIXTURE_MODULES: { id: string; course_id: string; title: string; published: boolean; visibility: string }[] = MODULES;
export const API_ORIGIN = new URL(process.env.PUBLIC_ACCEPT_API_URL || 'http://127.0.0.1:54321').origin;
export const byTitle = (t: string) => FIXTURE.find((c) => c.title === t)!;
/** Anonymous catalog, newest first: what the current policy plus the page's published filter should list. */
export const ANON_TITLES = FIXTURE.filter((c) => c.published).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((c) => c.title);

/** True only under playwright.public-catalog.config.ts, which sets the flag at load. Each spec file skips itself otherwise. */
export const UNDER_OWN_CONFIG = process.env.PUBLIC_ACCEPT_OWN_CONFIG === '1';
export const NOT_OWN_CONFIG_REASON = 'public-catalog specs run only under playwright.public-catalog.config.ts (its pins, guards and empty storage)';

/** There is one tier. The egress boundary (resolver, allowlist proxy with loopback forced through, route/WebSocket filter,
 *  redirect and service-worker observation) PREVENTS every foreign request, and every attempt FAILS the test, including the
 *  product's cdn.gpteng.co script and i.pravatar.cc avatars. There is no tolerated-third-party list. */
type Fixtures = { net: { requests: string[]; offOrigin: string[]; courseResponses: Response[]; unbound: string[] } };

/** Every response the browser actually receives from the app origin must be bound to the reviewed hermetic provenance:
 *  a pinned manifest file hashes to its pin, an SPA route or `/` hashes to the served index, anything else is UNBOUND. */
let PROV: { files: Record<string, string>; served_index_sha256: string } | null = null;
function provenance() {
  if (!PROV) {
    const r = loadProvenance(process.env.PUBLIC_ACCEPT_SERVED_DIR);
    if (r.error) throw new Error(`PUBLIC_CATALOG_E_SERVED_${r.error}`);
    PROV = r.prov;
  }
  return PROV!;
}

export const test = boundaryTest.extend<Fixtures>({
  net: async ({ page, baseURL, boundary }, use) => {
    void boundary; // the auto boundary fixture is installed first and fails the test on any violation
    const allowed = new Set([new URL(baseURL!).origin, API_ORIGIN]);
    const prov = provenance();
    const appOrigin = new URL(baseURL!).origin;
    const net = { requests: [] as string[], offOrigin: [] as string[], courseResponses: [] as Response[], unbound: [] as string[] };
    const bindings: Promise<void>[] = [];
    const errors: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (/^(data|blob|about):/.test(r.url())) return;
      net.requests.push(`${r.method()} ${u.origin}${u.pathname}`);
      if (!allowed.has(u.origin)) net.offOrigin.push(u.origin);
    });
    page.on('response', (r) => {
      const u = new URL(r.url());
      if (u.origin === API_ORIGIN && u.pathname === '/rest/v1/courses' && r.request().method() === 'GET') net.courseResponses.push(r);
      if (u.origin === appOrigin) {
        bindings.push((async () => {
          const want = expectedHash(prov, u.pathname);
          let got = '';
          try { got = r.status() === 200 ? sha256(await r.body()) : `status-${r.status()}`; } catch { got = 'unreadable'; }
          if (!want || got !== want) net.unbound.push(u.pathname);
        })());
      }
    });
    page.on('pageerror', () => errors.push('pageerror'));
    await use(net);
    await Promise.all(bindings);
    expect(net.unbound, 'every app-origin response is bound to the hermetic provenance').toEqual([]);
    expect(net.offOrigin, 'no foreign request attempt').toEqual([]);
    expect(errors, 'no uncaught page errors').toEqual([]);
  },
});
export { expect };

/** Waits for the page's own GET of the catalog and returns the rows the API actually served. */
export async function catalogRows(page: Page, path: string): Promise<{ title: string }[]> {
  const res = page.waitForResponse((r) => r.url().startsWith(`${API_ORIGIN}/rest/v1/courses`) && r.request().method() === 'GET' && /published=eq\.true/.test(r.url()));
  await page.goto(path);
  const r = await res;
  expect(r.status(), 'catalog GET status').toBe(200);
  return r.json();
}

export const cards = (page: Page) => page.locator('main button:has(h3)').filter({ visible: true });
export const cardTitles = async (page: Page) => (await cards(page).locator('h3').allTextContents()).map((t) => t.trim());
export const card = (page: Page, title: string) => cards(page).filter({ has: page.locator('h3', { hasText: title }) });
export const categoryTrigger = (page: Page) => page.getByRole('combobox', { name: 'Category' }).filter({ visible: true });

/** The exact "Estimated time" value nodes inside a scope: each visible element whose sr-only label is "Estimated time:", read
 *  as its whole normalized text. An independent oracle: it compares against literal strings, never the product formatter. */
export async function estimatedTimeNodes(scope: ReturnType<Page['locator']>): Promise<string[]> {
  return scope.locator('span.sr-only').evaluateAll((els) => els
    .filter((e) => (e.textContent ?? '').trim() === 'Estimated time:' && e.parentElement && e.parentElement.checkVisibility())
    .map((e) => (e.parentElement!.textContent ?? '').replace(/\s+/g, ' ').trim()));
}
