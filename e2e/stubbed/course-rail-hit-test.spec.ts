// ABOUTME: DOM hit-test for the course rail: the element under the centre of "Back to Courses" must be that
// ABOUTME: link, not the sticky Navbar stacked above the rail. Reproduces the owner's live finding (served
// ABOUTME: release ffa7d230 and main) and proves the fix. All network is stubbed: no Supabase, no credentials.
import { test, expect, type Route } from '@playwright/test';

const COURSE_ID = '123e4567-e89b-12d3-a456-426614174000';
const course = {
  id: COURSE_ID, title: 'Stubbed Course', description: 'A course that exists only in this test.',
  category: 'Data', level: 'Beginner', image_url: null, thumbnail: null, enrollment_status: 'open',
  duration: 4, tags: [], published: true, status: 'published', created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', instructor_id: 'i-1',
  instructor: { id: 'i-1', first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
};

async function stub(route: Route) {
  const req = route.request(); const url = new URL(req.url()); const accept = req.headers()['accept'] || '';
  const json = (body: unknown, headers: Record<string, string> = {}) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(body) });
  if (url.pathname.includes('/rest/v1/courses')) return json(accept.includes('object') ? course : [course]);
  if (url.pathname.includes('/rest/v1/enrollments')) {
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '0-0/3' }, body: '' });
    return json(accept.includes('object') ? null : []);
  }
  if (url.pathname.includes('/rest/v1/rpc/')) return json(/\/rpc\/(is_|has_|can_)/.test(url.pathname) ? false : []);
  if (url.pathname.includes('/rest/v1/')) return json(accept.includes('object') ? null : []);
  if (url.pathname.includes('/auth/v1/')) return json({ error: 'stubbed' });
  return route.abort();
}

test.describe('course rail hit-test (network stubbed)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    // Everything that is not the local preview server is intercepted: Supabase hosts get stubs, the rest is aborted.
    await page.route((u) => u.origin !== origin, (route) => {
      const host = new URL(route.request().url()).hostname;
      return /\.supabase\.(co|in)$/.test(host) ? stub(route) : route.abort();
    });
  });

  test('the element under "Back to Courses" is the link itself, not the navbar', async ({ page }) => {
    await page.goto(`/courses/${COURSE_ID}`);
    const back = page.getByRole('link', { name: 'Back to Courses' }).filter({ visible: true }).first();
    await expect(back).toBeVisible({ timeout: 30_000 });
    const box = (await back.boundingBox())!;
    const cx = Math.round(box.x + box.width / 2), cy = Math.round(box.y + box.height / 2);
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const link = el?.closest('a[href="/enrolled-courses"]');
      const header = el?.closest('header');
      return { tag: el?.tagName, isLink: !!link, insideHeader: !!header, text: (el?.textContent || '').trim().slice(0, 40) };
    }, [cx, cy]);
    test.info().annotations.push({ type: 'hit', description: JSON.stringify({ cx, cy, ...hit }) });
    console.log('HIT-TEST ' + JSON.stringify({ cx, cy, ...hit }));
    expect(hit.insideHeader, `element under the link centre is inside the Navbar: ${JSON.stringify(hit)}`).toBe(false);
    expect(hit.isLink, `element under the link centre is not the link: ${JSON.stringify(hit)}`).toBe(true);
    // A real click must leave the course page (the destination is protected and redirects to login; either way the URL changes).
    await page.mouse.click(cx, cy);
    await expect.poll(() => page.url(), { timeout: 10_000 }).not.toContain(`/courses/${COURSE_ID}`);
  });
});
