// ABOUTME: End-to-end coverage for the Explore Careers page — roles, filters, views, detail.
// ABOUTME: Every assertion is unconditional; a guarded assertion passes when the feature is gone.
import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

/** The catalogue in src/data/dataCareerRoles.ts. Pinned so a silent truncation fails. */
const TOTAL_ROLES = 33;
/** ExploreDataCareers paginates at 9 and Load More adds 6. */
const FIRST_PAGE = 9;

const countText = (page) => page.getByTestId('role-count').textContent();
const rows = (page) => page.getByTestId('role-row');
const cards = (page) => page.getByTestId('role-card');

test.describe('Explore Careers', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.exploreDataCareers);
    await waitForPageLoad(page);
    await expect(page.getByTestId('role-count')).toBeVisible();
  });

  test('lists the whole role catalogue', async ({ page }) => {
    // The count reflects the filtered set; the rows reflect the current page.
    expect(await countText(page)).toContain(`${TOTAL_ROLES} roles found`);
    await expect(rows(page)).toHaveCount(FIRST_PAGE);
  });

  test('Load More extends the list', async ({ page }) => {
    await expect(rows(page)).toHaveCount(FIRST_PAGE);
    await page.getByRole('button', { name: 'Load More' }).click();
    await expect(rows(page)).toHaveCount(FIRST_PAGE + 6);
  });

  test('the view toggle swaps list for grid over the same set', async ({ page }) => {
    await expect(rows(page)).toHaveCount(FIRST_PAGE);
    await expect(cards(page)).toHaveCount(0);

    await page.getByTestId('view-grid').click();
    await expect(cards(page)).toHaveCount(FIRST_PAGE);
    await expect(rows(page)).toHaveCount(0);
    // Same filtered set, different reading of it.
    expect(await countText(page)).toContain(`${TOTAL_ROLES} roles found`);

    await page.getByTestId('view-list').click();
    await expect(rows(page)).toHaveCount(FIRST_PAGE);
  });

  test('search narrows the set to matching roles', async ({ page }) => {
    await page.getByLabel("Search roles", { exact: true }).fill('cloud');
    // Cloud Data Engineer, Cloud Engineer, Cloud Security Engineer.
    await expect(rows(page)).toHaveCount(3);
    expect(await countText(page)).toContain('3 roles found');

    for (const title of ['Cloud Data Engineer', 'Cloud Engineer', 'Cloud Security Engineer']) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
  });

  test('search with no matches shows the empty state, and Clear All restores', async ({ page }) => {
    await page.getByLabel("Search roles", { exact: true }).fill('zzzznotarole');
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

    // Every visible row must actually belong to the selected track.
    const tracks = await rows(page).locator('td:nth-child(2)').allTextContents();
    for (const t of tracks) expect(t.trim()).toBe('Data Engineering');
  });

  test('opening a role shows all four tabs with real content', async ({ page }) => {
    await page.getByLabel("Search roles", { exact: true }).fill('AI Consultant');
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

  test('the career path tab links only to courses that exist', async ({ page }) => {
    await page.getByLabel("Search roles", { exact: true }).fill('Data Analyst');
    await rows(page).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Career Path' }).click();
    const panel = await dialog.getByRole('tabpanel').textContent();

    // The five real published courses. The old data referenced invented ones
    // ("Introduction to Data Analysis", "Deep Learning Fundamentals") that 404.
    expect(panel).toMatch(
      /Introduction to Data Science|Advanced Machine Learning|Data Engineering Fundamentals|Business Analytics with Python|Visualization with Tableau/,
    );
    expect(panel).not.toMatch(/Introduction to Data Analysis|Deep Learning Fundamentals|ETL Processes and Tools/);
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
});
