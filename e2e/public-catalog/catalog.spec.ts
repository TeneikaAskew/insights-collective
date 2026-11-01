// ABOUTME: Anonymous public catalog on a served build against a real loopback Supabase stack: GET -> render, estimated time,
// ABOUTME: the ?category= URL contract (pointer and keyboard), Back, the unknown notice, course detail and the private negative.
import { test, expect, UNDER_OWN_CONFIG, NOT_OWN_CONFIG_REASON, FIXTURE, ANON_TITLES, byTitle, catalogRows, cards, cardTitles, card, categoryTrigger } from './support';

test.skip(!UNDER_OWN_CONFIG, NOT_OWN_CONFIG_REASON);
// @ts-expect-error: plain ESM helper without type declarations
import { formatEstimatedHours } from '../../src/lib/estimatedTime';

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

  test('A2 every card shows Estimated time from estimated_hours only, never the legacy duration', async ({ page, net }) => {
    await catalogRows(page, '/courses');
    for (const c of FIXTURE.filter((f) => f.published)) {
      const el = card(page, c.title);
      await expect(el).toHaveCount(1);
      const want = formatEstimatedHours(c.estimated_hours);
      if (want) await expect(el).toContainText(`Estimated time: ${want}`);
      else await expect(el).not.toContainText('Estimated time');
      if (c.duration != null && formatEstimatedHours(c.duration) !== want) await expect(el).not.toContainText(`${c.duration} hour`);
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
    await catalogRows(page, '/courses?category=nope&q=');
    await expect(page.getByRole('status').filter({ hasText: '“nope”' })).toContainText('so courses from all categories are shown');
    await expect(cards(page)).toHaveCount(ANON_TITLES.length);
    await page.getByRole('button', { name: 'Clear category' }).click();
    await expect.poll(() => param(page.url())).toBe(null);
  });

  test('A8 course detail from a card shows the same Estimated time', async ({ page, net }) => {
    await catalogRows(page, '/courses');
    const c = byTitle('PCA Analytics Course');
    await card(page, c.title).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${c.id}$`));
    await expect(page.getByRole('heading', { name: c.title }).first()).toBeVisible();
    await expect(page.getByText(`Estimated time: ${formatEstimatedHours(c.estimated_hours)}`).filter({ visible: true }).first()).toBeAttached();
    await expect(page.getByText('PCA Unpublished Module')).toHaveCount(0);
  });

  test('A9 a private draft course is not rendered for an anonymous visitor, even by direct URL', async ({ page, net }) => {
    const c = byTitle('PCA Private Draft Course');
    const res = page.waitForResponse((r) => r.url().includes('/rest/v1/courses') && r.url().includes(c.id));
    await page.goto(`/courses/${c.id}`);
    const r = await res;
    const body = await r.text();
    expect(body, 'the API itself returned no private row').not.toContain(c.title);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(c.title)).toHaveCount(0);
  });

  test('A10 the home page features the three newest published courses with their Estimated time', async ({ page, net }) => {
    await page.goto('/');
    const section = page.locator('[data-tour="courses"]');
    await section.scrollIntoViewIfNeeded();
    for (const t of ANON_TITLES.slice(0, 3)) {
      const c = byTitle(t);
      const h = section.getByRole('heading', { name: t, level: 3 });
      await expect(h).toBeVisible({ timeout: 20_000 });
      const want = formatEstimatedHours(c.estimated_hours);
      if (want) await expect(h.locator('xpath=ancestor::a[1]')).toContainText(want);
    }
  });
});
