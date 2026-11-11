// ABOUTME: T-42 on the REAL served catalog for an anonymous visitor: the collapsed AppSidebar rail at 1180x757 exposes every
// ABOUTME: link with a computed accessible name. Desktop project only; the rail is not rendered at tablet/mobile widths.
import { shot } from './shot';
import { test, expect, UNDER_OWN_CONFIG, NOT_OWN_CONFIG_REASON } from './support';

test.skip(!UNDER_OWN_CONFIG, NOT_OWN_CONFIG_REASON);

test.use({ viewport: { width: 1180, height: 757 } });

test('S1 collapsed rail links have computed accessible names (anonymous, real backend)', async ({ page, net }, info) => {
  test.skip(info.project.name !== 'desktop', 'the T-42 rail shape exists at desktop width only');
  await page.goto('/courses');
  const rail = page.locator('[data-sidebar="sidebar"]').filter({ visible: true }).first();
  await expect(rail).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.group.peer[data-state="collapsed"][data-collapsible="icon"]')).toBeAttached();
  const expected = ['Insights Collective', 'Dashboard', 'Resources', 'Courses', 'Events', 'Career Pathway', 'Resume Analyzer'];
  const links = rail.getByRole('link');
  await expect(links).toHaveCount(expected.length);
  for (let i = 0; i < expected.length; i++) await expect(links.nth(i)).toHaveAccessibleName(expected[i]);
  await expect(rail.locator('a')).toHaveCount(expected.length);
  // Fixed-name synthetic capture of the asserted rail, desktop project only (after every assertion above; it asserts nothing).
  await shot(page, info, 'PC-rail-desktop-1180x757');
});
