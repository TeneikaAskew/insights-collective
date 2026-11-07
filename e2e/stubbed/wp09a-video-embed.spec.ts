// ABOUTME: WP-09A learner video embeds on the real CourseLearn route at 375/768/1440, signed out, every foreign request
// ABOUTME: stubbed: synthetic course rows, static fake provider pages, no Supabase, no credentials, no egress. Local tier only.
//
// Evidence tier: real Chromium layout, focus order, computed accessible names (toHaveAccessibleName) and Playwright's
// DOM-derived aria snapshot. NOT Chromium's native accessibility tree as exposed to assistive technology, and NOT a
// screen-reader pass (no NVDA, JAWS, VoiceOver or TalkBack is driven). NOT provider playback or captions (the provider
// frames are static fakes), and NOT end-to-end acceptance on the isolated backend.
//
// Isolation, as enforced by this file alone: the browser tests run only under the sealed video lane config
// (PUBLIC_VIDEO_SEALED=1, set by that config; otherwise skipped). baseURL must be exactly http://127.0.0.1:8080, the
// lane's in-container forwarder. Every request of every origin goes through the pure decide() in ./wp09a-decide.ts
// (unit controls: src/test/ci/wp09aDecide.test.ts): non-GET/HEAD is aborted first, same-origin GET/HEAD is continued (to
// that origin only), the synthetic API origin https://sealed-video.invalid (exact origin equality; the sealed build
// compiles it in) and the four provider hosts are fulfilled
// from constants, everything else is aborted; every WebSocket, same-origin included, is closed. Process-level egress
// (network none) is the outer lane's job, not this file's. Keeping this file out of main's signed-in
// playwright.config.ts projects (whose globalSetup and webServer would still run) is the shared config owner's job.
// test and expect come from PR134's sandbox fixture (worker browser override, AppArmor gate, per-test non-GET/WebSocket
// observer, worker egress ledger); page, context, baseURL, page.clock, outputPath and test.use stay stock.
import { test, expect } from './sandboxed-test';
import type { Page, Request } from '@playwright/test';
import { LANE_ORIGIN, SLOW_ID, assertLoopbackBase, decide, type Decision } from './wp09a-decide';

test.use({ storageState: { cookies: [], origins: [] } });

const COURSE = '00000000-0000-4000-8000-0000000c0001';
const MODULE = '00000000-0000-4000-8000-0000000c0002';
const ITEM = '00000000-0000-4000-8000-0000000c0003';

const DISALLOWED_HOST = 'media.example.invalid';

const SPACER = Array.from({ length: 600 }, (_, i) => `<p>Synthetic spacer paragraph ${i + 1}.</p>`).join('');

/** One synthetic lesson body: every case is a separate stored node, in the stored shapes the extension parses. */
const LESSON_HTML =
  '<p>Synthetic lesson introduction.</p>' +
  '<div data-youtube-video="" data-src="https://www.youtube.com/embed/AAAAAAAAAAA"><iframe src="https://www.youtube.com/embed/AAAAAAAAAAA" title="Synthetic YouTube lesson"></iframe></div>' +
  '<div class="video-embed"><iframe src="https://player.vimeo.com/video/123456789"></iframe></div>' +
  '<div data-youtube-video=""></div>' +
  `<div data-youtube-video="" data-src="https://${DISALLOWED_HOST}/x"><iframe src="https://${DISALLOWED_HOST}/x"></iframe></div>` +
  `<div data-youtube-video="" data-src="https://www.youtube.com/embed/${SLOW_ID}"><iframe src="https://www.youtube.com/embed/${SLOW_ID}" title="Synthetic slow video"></iframe></div>` +
  SPACER +
  '<div data-youtube-video="" data-src="https://www.youtube.com/embed/BELOWFOLD01"><iframe src="https://www.youtube.com/embed/BELOWFOLD01" title="Synthetic below-the-fold video"></iframe></div>';

const COURSE_ROW = { id: COURSE, title: 'Synthetic video course', thumbnail: null, settings: {} };
const MODULE_ROWS = [{ id: MODULE, course_id: COURSE, title: 'Synthetic module', position: 0, published: true }];
const ITEM_ROWS = [{
  id: ITEM, module_id: MODULE, course_id: COURSE, title: 'Synthetic video lesson', type: 'page', position: 0,
  published: true, content: LESSON_HTML, settings: {}, assignment: null, quiz: null,
}];

const FAKE_PROVIDER_PAGE =
  '<!doctype html><html><head><meta charset="utf-8"><title>Synthetic provider frame</title></head>' +
  '<body style="margin:0;font:14px sans-serif;background:#ddd"><p>Synthetic provider frame (no media)</p></body></html>';

type Logged = { method: string; host: string; path: string; decision: Decision };

/** Own-config guard: main's signed-in config never sets this; the sealed video lane config does. */
const UNDER_LANE_CONFIG = process.env.PUBLIC_VIDEO_SEALED === '1';

async function stubEverything(page: Page, baseURL: string | undefined, log: Logged[]) {
  const origin = assertLoopbackBase(baseURL);
  // Tours would cover the lesson; this key is the app's own e2e switch (SpotlightTour.tsx).
  await page.addInitScript(() => window.localStorage.setItem('e2e:disable-tours', '1'));
  await page.context().route(() => true, async (route) => {
    const req: Request = route.request();
    const url = new URL(req.url());
    const decision = decide(req.method(), req.url(), origin);
    log.push({ method: req.method(), host: url.host, path: url.pathname, decision });
    switch (decision) {
      case 'abort': return route.abort();
      case 'continue-loopback': return route.continue();
      case 'hold': return; // never answered: the slow case
      case 'provider': return route.fulfill({ status: 200, contentType: 'text/html', body: FAKE_PROVIDER_PAGE });
      case 'api': {
        if (url.pathname.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"error":"stubbed"}' });
        const wantsObject = (req.headers()['accept'] || '').includes('object');
        const json = (rows: unknown[], one: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? one : rows) });
        if (url.pathname.endsWith('/rest/v1/courses')) return json([COURSE_ROW], COURSE_ROW);
        if (url.pathname.endsWith('/rest/v1/modules')) return json(MODULE_ROWS, MODULE_ROWS[0]);
        if (url.pathname.endsWith('/rest/v1/content_items')) return json(ITEM_ROWS, ITEM_ROWS[0]);
        return route.fulfill({ status: 200, contentType: 'application/json', body: wantsObject ? 'null' : '[]' });
      }
    }
  });
  // Every WebSocket, same-origin included, is closed (a preview build opens none; a dev server's HMR socket would be).
  await page.context().routeWebSocket(() => true, (ws) => ws.close());
}

const providerHits = (log: Logged[], path: string) => log.filter((r) => r.decision === 'provider' && r.path === path).length;

/** The lesson's content column: the read-only editor surface that holds the video nodes. */
const columnBox = (page: Page) =>
  page.locator('[data-video-node]:visible').first().evaluate((el) => {
    const col = el.closest('.ProseMirror') as HTMLElement | null;
    if (!col) throw new Error('no .ProseMirror column around the video node');
    const r = col.getBoundingClientRect();
    return { left: r.left, right: r.right };
  });

const player = (page: Page, frameName: string) =>
  page.locator('[data-video-provider]:visible').filter({ has: page.locator(`iframe[title="${frameName}"]`) });

for (const vp of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test.describe(`learner video embeds ${vp.width}x${vp.height} (network stubbed)`, () => {
    test.skip(!UNDER_LANE_CONFIG, 'runs only under the sealed video lane config (PUBLIC_VIDEO_SEALED=1)');
    test.use({ viewport: vp });
    let log: Logged[];

    test.beforeEach(async ({ page, baseURL }) => {
      log = [];
      await page.clock.install();
      await stubEverything(page, baseURL!, log);
      await page.goto(`/courses/${COURSE}/learn/${MODULE}/${ITEM}`);
      await expect(page.getByText('Synthetic lesson introduction.').filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    });

    test.afterEach(async ({ page }, info) => { void page;
      await info.attach('request-log.json', { body: Buffer.from(JSON.stringify(log, null, 2)), contentType: 'application/json' });
      expect(log.filter((r) => r.host === DISALLOWED_HOST), 'no request to the disallowed host').toEqual([]);
      expect(log.filter((r) => !['GET', 'HEAD'].includes(r.method) && r.decision !== 'abort'), 'every non-GET aborted').toEqual([]);
      expect(log.filter((r) => r.decision === 'continue-loopback' && `http://${r.host}` !== LANE_ORIGIN), 'continued only to the lane origin').toEqual([]);
    });

    test('B1 YouTube: named, 16:9, inside the column, no horizontal scroll', async ({ page }, info) => {
      const frame = page.locator('iframe[title="Synthetic YouTube lesson"]:visible');
      await expect(frame).toHaveAccessibleName('Synthetic YouTube lesson');
      // Positive controls: the fake provider page was actually served for this frame, and the player saw its load.
      await expect.poll(() => providerHits(log, '/embed/AAAAAAAAAAA'), { message: 'fixture hit for the YouTube frame' }).toBeGreaterThanOrEqual(1);
      await expect(player(page, 'Synthetic YouTube lesson')).toHaveAttribute('data-video-state', 'loaded');
      const box = (await frame.boundingBox())!;
      const col = await columnBox(page);
      expect(Math.abs(box.width / box.height - 16 / 9) * box.height).toBeLessThanOrEqual(1);
      expect(box.x, 'left edge inside the content column').toBeGreaterThanOrEqual(col.left - 0.5);
      expect(box.x + box.width, 'right edge inside the content column').toBeLessThanOrEqual(col.right + 0.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`B1-youtube-${vp.width}.png`) });
    });

    test('B2 Vimeo without a stored title: default name, 16:9, inside the column', async ({ page }) => {
      const frame = page.locator('[data-video-provider="vimeo"]:visible iframe');
      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveAccessibleName('Vimeo video');
      await expect.poll(() => providerHits(log, '/video/123456789'), { message: 'fixture hit for the Vimeo frame' }).toBeGreaterThanOrEqual(1);
      await expect(page.locator('[data-video-provider="vimeo"]:visible')).toHaveAttribute('data-video-state', 'loaded');
      const box = (await frame.boundingBox())!;
      const col = await columnBox(page);
      expect(Math.abs(box.width / box.height - 16 / 9) * box.height).toBeLessThanOrEqual(1);
      expect(box.x, 'left edge inside the content column').toBeGreaterThanOrEqual(col.left - 0.5);
      expect(box.x + box.width, 'right edge inside the content column').toBeLessThanOrEqual(col.right + 0.5);
    });

    test('B3 no saved address: its own node holds a note and zero iframes', async ({ page }) => {
      const node = page.locator('[data-video-node]:visible').filter({ has: page.getByRole('note').filter({ hasText: 'This video has no saved address' }) });
      await expect(node).toHaveCount(1);
      await expect(node.locator('iframe')).toHaveCount(0);
      // Whole-lesson control: six stored video nodes, four of which (YouTube, Vimeo, slow, below the fold) are framed.
      await expect(page.locator('[data-video-node]:visible')).toHaveCount(6);
      await expect(page.locator('[data-video-node]:visible iframe')).toHaveCount(4);
    });

    test('B4 disallowed host: a note, no frame, no request', async ({ page }) => {
      await expect(page.getByRole('note').filter({ hasText: 'Only YouTube and Vimeo videos can be embedded' }).filter({ visible: true })).toHaveCount(1);
      await expect(page.locator(`iframe[src*="${DISALLOWED_HOST}"]`)).toHaveCount(0);
    });

    test('B5 slow provider: one held request, status after 15 s, Retry by keyboard issues exactly one new request and resets', async ({ page }) => {
      const slow = player(page, 'Synthetic slow video');
      const held = () => log.filter((r) => r.decision === 'hold' && r.path === `/embed/${SLOW_ID}`).length;
      await slow.scrollIntoViewIfNeeded();
      // Precondition: the frame's first request was issued and is being held, and the player is still loading.
      await expect.poll(held, { message: 'precondition: the initial request is held' }).toBe(1);
      await expect(slow).toHaveAttribute('data-video-state', 'loading');
      await expect(slow.getByRole('button', { name: 'Retry loading video' })).toHaveCount(0);
      await page.clock.fastForward(15_000);
      await expect(slow).toHaveAttribute('data-video-state', 'slow');
      await expect(slow.getByRole('status')).toHaveText('The YouTube player is taking longer than expected to load.');
      expect(held(), 'no extra request before Retry').toBe(1);
      const retry = slow.getByRole('button', { name: 'Retry loading video' });
      await retry.focus();
      await page.keyboard.press('Enter');
      await expect.poll(held, { message: 'Retry issued exactly one new request' }).toBe(2);
      // Reset: back to loading, the slow message and the Retry control are gone until the next 15 s elapse.
      await expect(slow).toHaveAttribute('data-video-state', 'loading');
      await expect(slow.getByRole('status')).toHaveText('Loading YouTube player…');
      await expect(slow.getByRole('button', { name: 'Retry loading video' })).toHaveCount(0);
    });

    // Written to the CORRECT behaviour. Expected to FAIL at the final assertion on 3e2d3b5 if the lazy-load finding
    // (packet section 6.1) is real. The preconditions FAIL (never skip) if the frame is not genuinely deferred: it must
    // sit more than LAZY_MARGIN px below the viewport (a conservative margin, assumed larger than Chromium's lazy-frame
    // distance threshold; not verified from Chromium source) and must have issued zero fixture requests before and
    // after the jump, with the page still scrolled to the top.
    test('B6 below the fold: not announced as slow while genuinely deferred', async ({ page }) => {
      const LAZY_MARGIN = 8000;
      const below = player(page, 'Synthetic below-the-fold video');
      await expect(player(page, 'Synthetic YouTube lesson'), 'precondition: the page has settled').toHaveAttribute('data-video-state', 'loaded');
      const top = await below.locator('iframe').evaluate((el) => el.getBoundingClientRect().top);
      expect(top - vp.height, 'precondition: frame is beyond the viewport plus margin').toBeGreaterThan(LAZY_MARGIN);
      expect(await page.evaluate(() => window.scrollY), 'precondition: still at the top').toBe(0);
      expect(providerHits(log, '/embed/BELOWFOLD01'), 'precondition: no request before the jump').toBe(0);
      await page.clock.fastForward(15_000);
      expect(await page.evaluate(() => window.scrollY), 'precondition: still at the top after the jump').toBe(0);
      expect(log.filter((r) => r.path === '/embed/BELOWFOLD01').length, 'precondition: no request after the jump').toBe(0);
      await expect(below.getByRole('status'), 'regression: a deferred frame is announced as slow').not.toHaveText(/taking longer than expected/);
    });

    // Scope limit: this proves only the local Tab segment frame <-> Watch link after PROGRAMMATIC focus on the link. It
    // does not prove keyboard-only reachability from page entry, and it never opens the external popup (target and
    // rel are asserted as attributes only).
    test('B7 local tab segment after programmatic focus: frame then its Watch link; popup attributes only', async ({ page }, info) => {
      const yt = player(page, 'Synthetic YouTube lesson');
      const link = yt.getByRole('link', { name: 'Watch on YouTube: Synthetic YouTube lesson (opens in a new tab)' });
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await link.focus();
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => (document.activeElement as HTMLIFrameElement | null)?.title)).toBe('Synthetic YouTube lesson');
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      await page.screenshot({ path: info.outputPath(`B7-focus-${vp.width}.png`) });
    });

    // Playwright's DOM-derived aria snapshot, not Chromium's native accessibility tree and not a screen-reader pass.
    // In Playwright 1.59.1 the snapshot always records an iframe with an EMPTY name (injected ariaSnapshot.ts, toAriaNode:
    // role 'iframe', name ''), so the frame's computed name is asserted with toHaveAccessibleName here and in B1.
    test('B8 Playwright aria snapshot: an unnamed iframe node, then the named Watch link', async ({ page }) => {
      const yt = player(page, 'Synthetic YouTube lesson');
      await expect(yt.locator('iframe')).toHaveAccessibleName('Synthetic YouTube lesson');
      await expect(yt).toMatchAriaSnapshot(`
        - iframe
        - link "Watch on YouTube: Synthetic YouTube lesson (opens in a new tab)"
      `);
    });
  });
}
