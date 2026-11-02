// ABOUTME: Anonymous public catalog on a served build against a real loopback Supabase stack: GET -> render, estimated time,
// ABOUTME: the ?category= URL contract (pointer and keyboard), Back, the unknown notice, course detail and the private negative.
import { test, expect, UNDER_OWN_CONFIG, NOT_OWN_CONFIG_REASON, FIXTURE, FIXTURE_MODULES, ANON_TITLES, byTitle, catalogRows, cards, cardTitles, card, categoryTrigger, estimatedTimeNodes } from './support';

test.skip(!UNDER_OWN_CONFIG, NOT_OWN_CONFIG_REASON);
/** LITERAL expected Estimated time per fixture title (independent of src/lib/estimatedTime.ts). null = no value node at all. */
const ESTIMATE: Record<string, string | null> = {
  'PCA Analytics Course': '2.5 hours',
  'PCA BI Course': '12 hours',
  'PCA Leading Space Course': '1 hour',
  'PCA Newline Name Course': null,
  'PCA Unicode Course': 'Under 0.1 hours',
  'PCA Published-Flag Draft-Status Course': '4 hours',
};
/** The three newest published fixtures, newest first, written out (not derived). */
const HOME_FEATURED = ['PCA Analytics Course', 'PCA BI Course', 'PCA Leading Space Course'];
const SENTINEL = 'pca_keep';

const param = (url: string) => new URL(url).searchParams.get('category');
const MENU = [
  'All categories (show all)', 'Analytics & BI', 'Business Intelligence', 'All categories (category)',
  'Data Science', 'Données & IA', 'Contradiction Category',
];

test.describe('anonymous catalog', () => {
  test('A1 GET -> render: the cards are exactly the rows the API served, and exactly the published fixtures', async ({ page, net }) => {
    const rows = await catalogRows(page, '/courses');
    await expect(cards(page)).toHaveCount(ANON_TITLES.length);
    expect(await cardTitles(page)).toEqual(rows.map((r) => r.title));
    expect(rows.map((r) => r.title)).toEqual(ANON_TITLES);
    expect(await cardTitles(page)).not.toContain('PCA Private Draft Course');
    expect(net.courseResponses.length).toBeGreaterThan(0);
  });

  test('A2 every card shows the literal Estimated time value node from estimated_hours, never the legacy duration', async ({ page, net }) => {
    await catalogRows(page, '/courses');
    expect(Object.keys(ESTIMATE).sort()).toEqual(FIXTURE.filter((f) => f.published).map((f) => f.title).sort());
    for (const [title, want] of Object.entries(ESTIMATE)) {
      const el = card(page, title);
      await expect(el).toHaveCount(1);
      expect(await estimatedTimeNodes(el), `${title} Estimated time value node`).toEqual(want ? [`Estimated time: ${want}`] : []);
      // Legacy-duration negative only where it discriminates: skip it when the legacy text is part of the expected value
      // (the flags course stores duration 4 and estimated_hours 4, so "4 hour" is inside the correct "4 hours").
      const c = byTitle(title);
      if (c.duration != null && !(want ?? '').includes(`${c.duration} hour`)) await expect(el).not.toContainText(`${c.duration} hour`);
    }
  });

  test('A3 the category menu lists computed accessible names that are normalized and unique', async ({ page, net }) => {
    await catalogRows(page, '/courses');
    await categoryTrigger(page).click();
    const options = page.getByRole('option');
    await expect(options).toHaveCount(MENU.length);
    for (let i = 0; i < MENU.length; i++) await expect(options.nth(i)).toHaveAccessibleName(MENU[i]);
    for (const n of MENU) await expect(page.getByRole('option', { name: n, exact: true })).toHaveCount(1);
  });

  test('A4 keyboard only: Tab to Category, open, arrow to a name, Enter; URL, cards; Back restores all', async ({ page, net }) => {
    await catalogRows(page, '/courses');
    let reached = false;
    for (let i = 0; i < 80 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await categoryTrigger(page).evaluate((el) => el === document.activeElement).catch(() => false);
    }
    expect(reached, 'Category combobox reachable with Tab').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    const focused = page.locator('[role="option"]:focus');
    for (let i = 0; i < MENU.length && ((await focused.count()) === 0 || (await focused.innerText()).trim() !== 'Business Intelligence'); i++) {
      await page.keyboard.press('ArrowDown');
    }
    await expect(page.locator('[role="option"]:focus')).toHaveAccessibleName('Business Intelligence');
    await page.keyboard.press('Enter');
    await expect.poll(() => param(page.url())).toBe('business-intelligence');
    expect(await cardTitles(page)).toEqual(['PCA BI Course']);
    await page.goBack();
    await expect.poll(() => param(page.url())).toBe(null);
    await expect(cards(page)).toHaveCount(ANON_TITLES.length);
  });

  test('A5 a stored name equal to the sentinel up to whitespace is its own option with its own URL', async ({ page, net }) => {
    await catalogRows(page, '/courses');
    await categoryTrigger(page).click();
    await page.getByRole('option', { name: 'All categories (category)', exact: true }).click();
    await expect.poll(() => param(page.url())).toBe('all-categories');
    expect(await cardTitles(page)).toEqual(['PCA Leading Space Course']);
    await expect(categoryTrigger(page)).toHaveText('All categories (category)');
  });

  test('A6 footer alias ?category=analytics selects the group entry with exactly its two courses', async ({ page, net }) => {
    await catalogRows(page, '/courses?category=analytics');
    await expect(categoryTrigger(page)).toHaveText('All in Analytics & BI (2 categories)');
    expect((await cardTitles(page)).sort()).toEqual(['PCA Analytics Course', 'PCA BI Course']);
  });

  test('A7 an unknown ?category= shows every course and says so; Clear category drops only that parameter', async ({ page, net }) => {
    await catalogRows(page, `/courses?category=nope&${SENTINEL}=1`);
    await expect(page.getByRole('status').filter({ hasText: '“nope”' })).toContainText('so courses from all categories are shown');
    await expect(cards(page)).toHaveCount(ANON_TITLES.length);
    await page.getByRole('button', { name: 'Clear category' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe(null);
    expect(new URL(page.url()).searchParams.get(SENTINEL), 'the unrelated query parameter survives Clear').toBe('1');
    expect([...new URL(page.url()).searchParams.keys()]).toEqual([SENTINEL]);
  });

  test('A8 course detail from a card shows the same literal Estimated time and only the public module', async ({ page, net }) => {
    await catalogRows(page, '/courses');
    const c = byTitle('PCA Analytics Course');
    await card(page, c.title).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${c.id}$`));
    await expect(page.getByRole('heading', { name: c.title }).first()).toBeVisible();
    const nodes = await estimatedTimeNodes(page.locator('main'));
    expect(nodes.length, 'at least one visible Estimated time value node').toBeGreaterThan(0);
    expect(new Set(nodes), 'every visible value node reads the literal value').toEqual(new Set(['Estimated time: 2.5 hours']));
    const pub = FIXTURE_MODULES.find((m) => m.course_id === c.id && m.published)!;
    const hidden = FIXTURE_MODULES.find((m) => m.course_id === c.id && !m.published)!;
    expect(pub.title).toBe('PCA Published Module');
    await expect(page.getByText(pub.title, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(hidden.title, { exact: true })).toHaveCount(0);
  });

  test('A9 a private draft course is not rendered for an anonymous visitor, even by direct URL', async ({ page, net }) => {
    const c = byTitle('PCA Private Draft Course');
    const res = page.waitForResponse((r) => r.url().includes('/rest/v1/courses') && r.url().includes(c.id));
    await page.goto(`/courses/${c.id}`);
    const r = await res;
    // Only ids are compared, so a failure never prints a response body.
    let ids: string[] = ['<unparseable>'];
    try { const j = await r.json(); ids = (Array.isArray(j) ? j : [j]).filter((x) => x && typeof x.id === 'string').map((x) => x.id); } catch { /* stays unparseable */ }
    expect(ids, 'the API itself returned no private row').not.toContain(c.id);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(c.title)).toHaveCount(0);
  });

  test('A10 the home page features exactly the three newest published courses with their literal Estimated time', async ({ page, net }) => {
    await page.goto('/');
    const section = page.locator('[data-tour="courses"]');
    await section.scrollIntoViewIfNeeded();
    const headings = section.getByRole('heading', { level: 3 }).filter({ visible: true });
    await expect(headings).toHaveCount(HOME_FEATURED.length, { timeout: 20_000 });
    expect((await headings.allTextContents()).map((t) => t.trim())).toEqual(HOME_FEATURED);
    for (const t of HOME_FEATURED) {
      const cardLink = section.getByRole('heading', { name: t, level: 3, exact: true }).locator('xpath=ancestor::a[1]');
      expect(await estimatedTimeNodes(cardLink), `${t} featured Estimated time`).toEqual([`Estimated time: ${ESTIMATE[t]}`]);
    }
  });
});
