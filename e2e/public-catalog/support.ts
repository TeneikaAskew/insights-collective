// ABOUTME: Shared fixture for the anonymous public-catalog specs: records every request, refuses any origin other than the
// ABOUTME: app and the loopback API, fails on page errors, and exposes the API's real course responses (GET -> render).
import { test as base, expect, type Page, type Response } from '@playwright/test';
// @ts-expect-error: plain ESM data module without type declarations
import { COURSES } from '../../scripts/public-catalog-fixture/fixtures.mjs';

export type FixtureCourse = { id: string; title: string; category: string; estimated_hours: number | null; duration: number | null; published: boolean; status: string; created_at: string; visibility: string };
export const FIXTURE: FixtureCourse[] = COURSES;
export const API_ORIGIN = new URL(process.env.PUBLIC_ACCEPT_API_URL || 'http://127.0.0.1:54321').origin;
export const byTitle = (t: string) => FIXTURE.find((c) => c.title === t)!;
/** Anonymous catalog, newest first: what the current policy plus the page's published filter should list. */
export const ANON_TITLES = FIXTURE.filter((c) => c.published).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((c) => c.title);

/** Every off-origin request is ABORTED before it is sent (prevention). Whether an attempt FAILS the test depends on the tier:
 *  - authentic (the default, and the only tier run.sh accepts): ANY foreign attempt fails, including the two known ones.
 *    The served app must be the reviewed hermetic test-served derivation and the page data must not hotlink foreign images.
 *  - rehearsal (PUBLIC_ACCEPT_TIER=rehearsal, loopback shim only): the two known product attempts below are reported as
 *    annotations instead of failing, so the rest of the page can be exercised. A rehearsal result is never acceptance. */
/** True only under playwright.public-catalog.config.ts, which sets the flag at load. Each spec file skips itself otherwise. */
export const UNDER_OWN_CONFIG = process.env.PUBLIC_ACCEPT_OWN_CONFIG === '1';
export const NOT_OWN_CONFIG_REASON = 'public-catalog specs run only under playwright.public-catalog.config.ts (its guards and empty storage)';
export const TIER = process.env.PUBLIC_ACCEPT_TIER === 'rehearsal' ? 'rehearsal' : 'authentic';
export const KNOWN_THIRD_PARTY = ['https://cdn.gpteng.co/gptengineer.js', 'https://i.pravatar.cc/'];

type Fixtures = { net: { requests: string[]; offOrigin: string[]; blockedKnown: string[]; courseResponses: Response[] } };

export const test = base.extend<Fixtures>({
  net: async ({ page, baseURL }, use) => {
    const appOrigin = new URL(baseURL!).origin;
    const net = { requests: [] as string[], offOrigin: [] as string[], blockedKnown: [] as string[], courseResponses: [] as Response[] };
    await page.context().route((u) => u.origin !== appOrigin && u.origin !== API_ORIGIN, (route) => {
      const url = route.request().url();
      if (TIER === 'rehearsal' && KNOWN_THIRD_PARTY.some((k) => (k.endsWith('/') ? url.startsWith(k) : url === k))) net.blockedKnown.push(url); else net.offOrigin.push(url);
      return route.abort();
    });
    const errors: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      net.requests.push(`${r.method()} ${u.origin}${u.pathname}`);
    });
    page.on('response', (r) => { const u = new URL(r.url()); if (u.origin === API_ORIGIN && u.pathname === '/rest/v1/courses' && r.request().method() === 'GET') net.courseResponses.push(r); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await use(net);
    if (net.blockedKnown.length) test.info().annotations.push({ type: 'rehearsal-tolerated-foreign-attempt', description: [...new Set(net.blockedKnown)].join(' ') });
    expect(net.offOrigin, `no foreign request attempt (${TIER} tier)`).toEqual([]);
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
