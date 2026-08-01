// ABOUTME: Measures horizontal overflow on <main>, the element that actually scrolls.
// ABOUTME: Shared by the signed-in and signed-out mobile-overflow specs.
import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import { PAGE_MANIFEST } from '../../src/config/pageManifest';

/**
 * The mobile check that shipped with the Explore Careers work was:
 *
 *   document.documentElement.scrollWidth - document.documentElement.clientWidth
 *
 * It reported 0 on every page, including one that put a 780px table in a 390px
 * viewport. `AppLayout` wraps the app in `overflow-hidden` and scrolls inside
 * `<main class="flex-1 w-full overflow-auto">`, so that expression is pinned at
 * 0 no matter how broken the layout is — a check that could only return green.
 *
 * `<main>` is the scroll container, so `main.scrollWidth > main.clientWidth` is
 * precisely "the reader has to scroll sideways".
 */
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

export interface OverflowReport {
  /** Horizontal overflow on the scroll container, in px. */
  main: number;
  /** Widest non-clipping descendant, named so a failure points somewhere. */
  worst: { selector: string; over: number } | null;
  pathname: string;
}

export async function measureOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    // `/`, `/login`, `/register` and `/reset-password` render outside AppLayout
    // and have no <main>. There is no `overflow-hidden` wrapper on those, so
    // documentElement is the real scroll container and measuring it is sound —
    // verified by planting an oversized box on each and confirming the
    // expression reports it rather than staying at 0.
    const main = document.querySelector('main');
    const scope = main ?? document.documentElement;

    // An element whose own overflow-x is auto, scroll or hidden cannot push the
    // page sideways — it scrolls its content or clips it. Excluding `hidden`
    // matters: the landing page's `section.py-20.overflow-hidden` holds a
    // deliberately oversized decorative layer, and a detector that flagged it
    // reported a 128px defect on a page that had none.
    //
    // A clipper that is itself too wide is still caught, on its parent, whose
    // scrollWidth counts the clipper's whole border box.
    let worst: { selector: string; over: number } | null = null;
    for (const el of Array.from(scope.querySelectorAll('*'))) {
      const over = el.scrollWidth - el.clientWidth;
      if (over <= 1) continue;
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') continue;
      if (!worst || over > worst.over) {
        const classes =
          typeof el.className === 'string' && el.className.trim()
            ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
            : '';
        worst = { over, selector: el.tagName.toLowerCase() + classes };
      }
    }

    return {
      main: scope.scrollWidth - scope.clientWidth,
      worst,
      pathname: location.pathname,
    };
  });
}

/**
 * A screenshot that actually shows the whole page.
 *
 * `fullPage: true` extends the capture to the *document's* scroll height, and
 * in this app the document never scrolls — AppLayout clips at `overflow-hidden`
 * and scrolls inside `<main>`. So `fullPage` silently returns a viewport-height
 * image: /career-pathway captured 900px of an 1100px page and the whole report
 * canvas was missing from the shot, which is how a screenshot review misses
 * everything below the fold.
 *
 * Growing the viewport to fit the content is the fix. Width — the only axis
 * this spec is about — stays at 390. Height changes, so any `vh`-sized element
 * renders taller here than on a real phone; that is a known and accepted
 * distortion in exchange for seeing the page at all.
 */
async function fullHeightScreenshot(page: Page): Promise<Buffer> {
  const original = page.viewportSize();
  const contentHeight = await page.evaluate(() => {
    const main = document.querySelector('main');
    return Math.max(
      main ? main.scrollHeight : 0,
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
  });
  // Capped: a runaway list should not try to allocate a 40,000px bitmap.
  const height = Math.min(Math.max(contentHeight + 40, original?.height ?? 844), 6000);
  await page.setViewportSize({ width: original?.width ?? MOBILE_VIEWPORT.width, height });
  await page.waitForTimeout(400);
  const body = await page.screenshot();
  if (original) await page.setViewportSize(original);
  return body;
}

/**
 * Navigate to `route` at phone width, attach a screenshot, and fail if the page
 * scrolls sideways — or if it never rendered the route that was asked for.
 */
export async function expectNoMobileOverflow(
  page: Page,
  testInfo: TestInfo,
  route: string,
): Promise<void> {
  await page.goto(route);
  // Wait for the app to mount rather than for a load event: several of these
  // routes stream their data in after first paint. Not `main` — the auth pages
  // and the landing page render outside AppLayout and never have one.
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return !!root && root.children.length > 0;
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(1200);

  const report = await measureOverflow(page);

  await testInfo.attach(`${route === '/' ? '_root' : route.replace(/\//g, '_')}-390.png`, {
    body: await fullHeightScreenshot(page),
    contentType: 'image/png',
  });

  // A redirect means the page under test never rendered. Say so rather than
  // passing on whatever appeared instead — that is exactly how a signed-out
  // sweep reports the auth-gated routes as healthy without ever seeing them.
  expect(
    report.pathname,
    `${route} redirected to ${report.pathname}; nothing about ${route} was measured`,
  ).toBe(route);

  expect(
    report.main,
    `${route} overflows ${report.main}px` +
      (report.worst ? `; widest offender ${report.worst.selector} at ${report.worst.over}px` : ''),
  ).toBeLessThanOrEqual(1);
}

/** Every canonical manifest path, sections and children, in declaration order. */
export function manifestPaths(): string[] {
  return PAGE_MANIFEST.flatMap((section) => [
    section.path,
    ...(section.children ?? []).map((child) => child.path),
  ]);
}
