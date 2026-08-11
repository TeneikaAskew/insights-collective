// ABOUTME: End-to-end coverage for the Explore Careers page — roles, filters, views, detail.
// ABOUTME: Every assertion is unconditional; a guarded assertion passes when the feature is gone.
import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';
import { stubCourseraCatalog } from '../helpers/coursera-helpers';

/** The catalog in src/data/dataCareerRoles.ts. Pinned so a silent truncation fails. */
const TOTAL_ROLES = 33;
/** ExploreDataCareers paginates at 9 and Load More adds 6. */
const FIRST_PAGE = 9;
/**
 * Cards in the By Category view. Deliberately NOT TOTAL_ROLES: that view lists
 * a role under every track it belongs to, and 4 of the 33 roles carry two
 * categories ("Analytics, Business Intelligence" and friends), so 33 roles
 * yield 37 cards. Derived from src/data/dataCareerRoles.ts by summing
 * role.category.split(',').length; CI received exactly 37 when this was
 * pinned to 33.
 */
const CATEGORY_VIEW_CARDS = 37;

const countText = (page) => page.getByTestId('role-count').textContent();
/**
 * `:visible`, not getByTestId, because the List view ships two presentations of
 * the same rows — a table from `sm` up and stacked cards below it — and CSS
 * decides which one shows. Both are in the DOM at every width, and
 * `locator.count()` counts hidden elements too, so the plain testid returns 18
 * where 9 are on screen.
 */
const rows = (page) => page.locator('[data-testid="role-row"]:visible');
const cards = (page) => page.locator('[data-testid="role-card"]:visible');

/**
 * Platform courses always outrank Coursera, so which subjects fall through
 * to the external list depends on what's published in the live database.
 * Stubbing the published list empty makes every subject uncovered — the
 * Coursera picks then come one-per-subject from the fixture, deterministically.
 * (The glob does not match coursera_courses: that path segment starts with
 * "coursera", not "courses".)
 */
const stubNoPlatformCourses = (page: import('@playwright/test').Page) =>
  page.route('**/rest/v1/courses?*', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      : route.continue(),
  );

test.describe('Explore Careers', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.exploreDataCareers);
    await waitForPageLoad(page);
    await expect(page.getByTestId('role-count')).toBeVisible();
  });

  test('lists the whole role catalog', async ({ page }) => {
    // The count reflects the filtered set; the rows reflect the current page.
    expect(await countText(page)).toContain(`${TOTAL_ROLES} roles found`);
    await expect(rows(page)).toHaveCount(FIRST_PAGE);
  });

  test('Load More extends the list', async ({ page }) => {
    await expect(rows(page)).toHaveCount(FIRST_PAGE);
    await page.getByRole('button', { name: 'Load More' }).click();
    await expect(rows(page)).toHaveCount(FIRST_PAGE + 6);
  });

  test('the view tabs swap the rendering over the same filtered set', async ({ page }) => {
    await expect(rows(page)).toHaveCount(FIRST_PAGE);
    await expect(cards(page)).toHaveCount(0);

    await page.getByTestId('view-grid').click();
    await expect(cards(page)).toHaveCount(FIRST_PAGE);
    await expect(rows(page)).toHaveCount(0);
    // Same filtered set, different reading of it.
    expect(await countText(page)).toContain(`${TOTAL_ROLES} roles found`);

    // By Category groups the whole catalog rather than the current page —
    // one card per category membership, so more cards than roles.
    await page.getByTestId('view-categories').click();
    await expect(cards(page)).toHaveCount(CATEGORY_VIEW_CARDS);

    await page.getByTestId('view-list').click();
    await expect(rows(page)).toHaveCount(FIRST_PAGE);
  });

  test('search narrows the set to matching roles', async ({ page }) => {
    await page.getByLabel('Search roles', { exact: true }).fill('cloud');
    // Cloud Data Engineer, Cloud Engineer, Cloud Security Engineer.
    await expect(rows(page)).toHaveCount(3);
    expect(await countText(page)).toContain('3 roles found');

    for (const title of ['Cloud Data Engineer', 'Cloud Engineer', 'Cloud Security Engineer']) {
      // filter({ visible: true }): each row's title exists twice in the DOM
      // (hidden mobile card + table cell), so the bare getByText resolves to 2
      // elements and toBeVisible dies on a strict-mode violation.
      await expect(page.getByText(title, { exact: true }).filter({ visible: true })).toBeVisible();
    }
  });

  test('search with no matches shows the empty state, and Clear All restores', async ({ page }) => {
    await page.getByLabel('Search roles', { exact: true }).fill('zzzznotarole');
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText('No roles match your search')).toBeVisible();

    await page.getByRole('button', { name: 'Clear All Filters' }).first().click();
    expect(await countText(page)).toContain(`${TOTAL_ROLES} roles found`);
  });

  test('category filter narrows to that track only', async ({ page }) => {
    await page.getByRole('button', { name: 'Data Engineering', exact: true }).click();

    const shown = Number((await countText(page))!.match(/^(\d+)/)![1]);
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(TOTAL_ROLES);

    // Every visible row must actually belong to the selected track. Read the
    // testid rather than `td:nth-child(2)` — below `sm` the list renders as
    // stacked cards with no cells, and the cell selector would quietly match
    // nothing and assert nothing.
    const tracks = await page.locator('[data-testid="role-track"]:visible').allTextContents();
    expect(tracks.length).toBeGreaterThan(0);
    for (const t of tracks) expect(t.trim()).toBe('Data Engineering');
  });

  test('opening a role shows all four tabs with real content', async ({ page }) => {
    await page.getByLabel('Search roles', { exact: true }).fill('AI Consultant');
    await expect(rows(page)).toHaveCount(1);
    await rows(page).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (const tab of ['Overview', 'Day in the Life', 'Month in the Life', 'Career Path']) {
      await expect(dialog.getByRole('tab', { name: tab })).toBeVisible();
    }

    // AI Consultant had no schedule before the content pass; it now has seven
    // timed entries, so this fails if that content is ever dropped.
    await dialog.getByRole('tab', { name: 'Day in the Life' }).click();
    const times = await dialog.getByRole('tabpanel').textContent();
    expect(times!.match(/\d{1,2}:\d{2}\s?(AM|PM)/g)!.length).toBe(7);
  });

  test('a ?role= deep link opens that role, even when it is off the first page', async ({ page }) => {
    // The quiz results link here as /explore-data-careers?role=data-analyst.
    // Sorted alphabetically and paginated at nine, "Data Analyst" is not
    // rendered on load, so the old scrollIntoView found nothing and the user
    // landed at the top of an unrelated list with no sign anything happened.
    await goto(page, `${Routes.exploreDataCareers}?role=data-analyst`);
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(dialog.getByText('Data Analyst').first()).toBeVisible();

    // Proves the premise: the role is genuinely absent from the rendered page.
    await expect(page.locator('#role-data-analyst')).toHaveCount(0);
  });

  test('the Career Resources links point at routes that exist', async ({ page }) => {
    // All four previously pointed at routes with no <Route>, falling through to
    // NotFound: /resources/salary-guide, /career-pathway/skills-assessment,
    // /career-pathway/planner, /resources/interview-prep.
    for (const [name, href] of [
      ['Take the Career Assessment', '/career-agent'],
      ['Your Career Report', '/career-pathway'],
      ['Interview Preparation', '/interview-prep'],
      ['All Resources', '/resources'],
    ]) {
      await expect(page.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  test('role detail career path recommends stubbed Coursera courses safely', async ({ page }) => {
    await stubCourseraCatalog(page);
    await stubNoPlatformCourses(page);
    await goto(page, Routes.exploreDataCareers);

    await page.getByTestId('view-grid').click();
    await page.getByRole('button', { name: /Explore role/ }).first().click();
    await page.getByRole('tab', { name: 'Career Path' }).click();

    // The fixture catalog backs the recommendation list, so the exact course
    // is deterministic — and external links must be new-tab with a safe rel.
    const external = page.getByRole('link', { name: /E2E SQL Foundations/ });
    await expect(external).toBeVisible({ timeout: 15_000 });
    await expect(external).toHaveAttribute('href', 'https://www.coursera.org/learn/e2e-sql-foundations');
    await expect(external).toHaveAttribute('target', '_blank');
    await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // Inverted deliberately. This test previously asserted that an empty database
  // result still produced coursera.org links, because the bundled catalog served
  // in its place — which is the behavior this change removes. Asserting the OLD
  // contract would now be asserting that the fallback is still there.
  test('an empty catalog result shows no external courses rather than bundled ones', async ({
    page,
  }) => {
    await stubCourseraCatalog(page, []);
    await stubNoPlatformCourses(page);
    await goto(page, Routes.exploreDataCareers);

    await page.getByTestId('view-grid').click();
    await page.getByRole('button', { name: /Explore role/ }).first().click();
    await page.getByRole('tab', { name: 'Career Path' }).click();

    // The tab itself must still render — an empty catalog is not an error.
    await expect(page.getByRole('tab', { name: 'Career Path' })).toBeVisible();

    // And nothing may appear that the database did not supply. Before this
    // change 180 build-time courses would have been here.
    await expect(page.locator('a[href^="https://www.coursera.org/"]')).toHaveCount(0);
  });

  test('a failed catalog read says so instead of silently showing nothing', async ({ page }) => {
    // The state that was unreachable while the fallback existed: the read fails,
    // and previously the section rendered bundled courses as if all were well.
    await page.route('**/rest/v1/coursera_courses*', route =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'simulated outage' }),
      }),
    );
    await stubNoPlatformCourses(page);
    await goto(page, Routes.exploreDataCareers);

    await page.getByTestId('view-grid').click();
    await page.getByRole('button', { name: /Explore role/ }).first().click();
    await page.getByRole('tab', { name: 'Career Path' }).click();

    await expect(
      page.getByText(/Couldn't load course recommendations/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible();
  });

  test('the career path tab links only to courses that exist', async ({ page }) => {
    await page.getByLabel('Search roles', { exact: true }).fill('Data Analyst');
    await rows(page).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Career Path' }).click();

    const panel = dialog.getByRole('tabpanel');
    await expect(panel).toBeVisible();

    // Recommendations come from published platform courses with a Coursera
    // fallback, so the titles vary. What must never come back are the
    // placeholder ids the legacy `courses` field carried — every /courses/da101
    // link 404'd. Assert on the hrefs rather than the copy.
    // The panel is visible as soon as the career-progression steps render, and
    // those come from static role data. The course lists arrive later, from the
    // published-courses read and a ~969-row Coursera catalog query, so reading
    // hrefs the moment the panel appears collects an empty list and fails on
    // `toBeGreaterThan(0)` — measured against a catalog that holds plenty for
    // this role. Wait for the recommendations rather than for the tab.
    await expect
      .poll(() => panel.getByRole('link').count(), { timeout: 20_000 })
      .toBeGreaterThan(0);

    const hrefs = await panel.getByRole('link').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href') ?? ''),
    );

    for (const href of hrefs) {
      expect(href, `${href} is a legacy placeholder course id`).not.toMatch(
        /\/courses\/(da|ml|de|bi|sql)\d{3}$/,
      );
      // Anything internal must be a real route: /courses, or /courses/<uuid>.
      if (href.startsWith('/courses/')) {
        expect(href).toMatch(
          /^\/courses\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
      }
    }
  });

  test('every role ends with five similar roles, and following one swaps the dialog', async ({ page }) => {
    await goto(page, `${Routes.exploreDataCareers}?role=bi-analyst`);
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Similar Roles' })).toBeVisible();

    // `:visible` for the same reason the row helper uses it — count() does not
    // filter, and the section is inside a dialog that is only ever one deep.
    const similar = dialog.locator('[data-testid="similar-role"]:visible');
    await expect(similar).toHaveCount(5);

    const titleText = () =>
      dialog.locator('[data-testid="similar-role-title"]:visible').allTextContents();
    const titles = (await titleText()).map((t) => t.trim());
    expect(titles).not.toContain('Business Intelligence Analyst');

    const target = titles[0];
    await similar.first().click();

    // Same dialog, now showing the role that was followed — scrolled back to
    // the top and reset to Overview rather than left on the previous tab.
    await expect(dialog.getByTestId('role-detail-title')).toHaveText(target);
    await expect(dialog.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'data-state',
      'active',
    );

    // The section follows along: the role now open never recommends itself.
    await expect(similar).toHaveCount(5);
    expect((await titleText()).map((t) => t.trim())).not.toContain(target);
  });
});
