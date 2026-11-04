// ABOUTME: T-42 reproduction on the exact target shape: the GLOBAL AppSidebar rail collapsed at 1180x757 must not
// ABOUTME: expose icon-only links without a COMPUTED accessible name. All network stubbed; signed-out viewer.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1180, height: 757 } });

test.describe('AppSidebar collapsed rail names (network stubbed)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    await page.context().route((u) => u.origin !== origin, (route) => {
      const url = new URL(route.request().url());
      if (/\.supabase\.(co|in)$/.test(url.hostname)) {
        if (url.pathname.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"error":"stubbed"}' });
        const accept = route.request().headers()['accept'] || '';
        return route.fulfill({ status: 200, contentType: 'application/json', body: accept.includes('object') ? 'null' : '[]' });
      }
      return route.abort();
    });
    await page.context().routeWebSocket((u) => u.origin.replace(/^ws/, 'http') !== origin, (ws) => ws.close());
  });

  test('every link in the collapsed rail has an accessible name', async ({ page }) => {
    // AppLayout's rail defaults to collapsed (no app-sidebar:state cookie in a fresh context), which is the T-42 shape.
    await page.goto('/course-management');
    const rail = page.locator('[data-sidebar="sidebar"]').filter({ visible: true }).first();
    await expect(rail).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.group.peer[data-state="collapsed"][data-collapsible="icon"]')).toBeAttached({ timeout: 10_000 });
    await page.screenshot({ path: test.info().outputPath('collapsed-rail.png') });

    // Computed accessible names from Chromium's accessibility tree (role=link), never aria-label/title/textContent.
    // Signed-out viewer, collapsed: home plus the six browse links, in this order, each with exactly this name.
    const expected = ['Insights Collective', 'Dashboard', 'Resources', 'Courses', 'Events', 'Career Pathway', 'Resume Analyzer'];
    const roleLinks = rail.getByRole('link');
    await expect(roleLinks).toHaveCount(expected.length);
    for (let i = 0; i < expected.length; i++) await expect(roleLinks.nth(i)).toHaveAccessibleName(expected[i]);
    // Every <a> in the rail is one of those role=link entries (no anchor dropped out of the tree unnamed).
    await expect(rail.locator('a')).toHaveCount(expected.length);
    // The aria snapshot is ASSERTED, not logged.
    const snapshot = await rail.ariaSnapshot();
    expect(snapshot.split('\n').map((l) => l.match(/^\s*- link(?: "(.*)")?:?$/)).filter(Boolean).map((m) => m![1] ?? ''), 'link entries in the aria snapshot').toEqual(expected);
  });

  test('oracle self-check: an aria-hidden or CSS-hidden-only label is not an accessible name', async ({ page }) => {
    await page.goto('/course-management');
    await page.evaluate(() => {
      const nav = document.createElement('nav');
      nav.id = 't42-oracle';
      nav.innerHTML = '<a href="/x"><span aria-hidden="true">Hidden by aria</span></a>'
        + '<a href="/y"><span style="display:none">Hidden by CSS</span></a>';
      document.body.appendChild(nav);
    });
    const anchors = page.locator('#t42-oracle a');
    // The old proxy (aria-label || title || textContent) would call both named.
    expect(await anchors.evaluateAll((as) => as.map((a) => (a.textContent || '').trim()))).toEqual(['Hidden by aria', 'Hidden by CSS']);
    await expect(anchors.nth(0)).toHaveAccessibleName('');
    await expect(anchors.nth(1)).toHaveAccessibleName('');
  });
});
