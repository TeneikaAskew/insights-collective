// ABOUTME: The BLS wage data contract — the spec that catches an un-applied migration.
// ABOUTME: Asserts the figures reach the page and that every distribution is well formed.
import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

const TOTAL_ROLES = 33;
const FIRST_PAGE = 9;

/**
 * `:visible` throughout. The List view ships a table from `sm` up and stacked
 * cards below it, both in the DOM at every width with CSS choosing between them,
 * and `locator.count()` counts hidden elements — so a plain testid returns twice
 * the number of rows actually on screen.
 */

test.describe('BLS wage data', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.exploreDataCareers);
    await waitForPageLoad(page);
    await expect(page.getByTestId('role-count')).toBeVisible();
    // Wage data arrives after first paint. Locator.all() and evaluateAll() do
    // not auto-retry, so anything reading attributes must wait for the bands
    // first or it races the query.
    await expect(page.locator('[data-testid="wage-band"]:visible')).toHaveCount(FIRST_PAGE);
  });

  /** The sidebar uses Radix Selects, so selectOption() does not apply. */
  async function chooseFromSelect(page, label: string, option: string) {
    // exact:true — the mobile bar carries "Salary Range (mobile)", which a
    // substring match would also hit.
    await page.getByLabel(label, { exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  }

  test('every visible role carries a wage band', async ({ page }) => {
    // If `career_role_wages` is missing or RLS blocks the read, this is 0 and
    // the page silently shows no pay at all. That is the failure to catch.
    await expect(page.locator('[data-testid="wage-band"]:visible')).toHaveCount(FIRST_PAGE);
  });

  test('the grid prints the range beside the band', async ({ page }) => {
    // The list table has its own Typical pay column, so the band suppresses its
    // range there; the cards carry it, and this is where it is asserted.
    await page.getByTestId('view-grid').click();
    await expect(page.locator('[data-testid="role-card"]:visible')).toHaveCount(FIRST_PAGE);
    await expect(page.locator('[data-testid="wage-range"]:visible')).toHaveCount(FIRST_PAGE);
  });

  test('percentiles are present and correctly ordered', async ({ page }) => {
    const bands = await page.locator('[data-testid="wage-band"]:visible').all();
    expect(bands.length).toBe(FIRST_PAGE);

    for (const band of bands) {
      const n = async (attr: string) => Number(await band.getAttribute(attr));
      const [p10, p25, median, p75, p90] = await Promise.all(
        ['data-pct10', 'data-pct25', 'data-median', 'data-pct75', 'data-pct90'].map(n),
      );

      for (const v of [p10, p25, median, p75, p90]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
      // Mirrors the CHECK constraint on bls_occupations.
      expect(p10).toBeLessThanOrEqual(p25);
      expect(p25).toBeLessThanOrEqual(median);
      expect(median).toBeLessThanOrEqual(p75);
      expect(p75).toBeLessThanOrEqual(p90);
    }
  });

  test('the printed range matches the underlying percentiles', async ({ page }) => {
    await page.getByTestId('view-grid').click();
    await expect(page.locator('[data-testid="role-card"]:visible')).toHaveCount(FIRST_PAGE);

    const band = page.locator('[data-testid="wage-band"]:visible').first();
    const p25 = Number(await band.getAttribute('data-pct25'));
    const p75 = Number(await band.getAttribute('data-pct75'));

    const printed = (await page.locator('[data-testid="wage-range"]:visible').first().textContent())!;
    expect(printed).toContain(`$${Math.round(p25 / 1000)}k`);
    expect(printed).toContain(`$${Math.round(p75 / 1000)}k`);
  });

  test('figures are attributed to a named BLS occupation', async ({ page }) => {
    // A pay figure with no source is the thing this whole feature exists to avoid.
    // Scoped to the visible rows. Unscoped, `.first()` resolved to the stacked
    // mobile card's attribution line — present in the DOM at every width and
    // hidden at desktop — so the assertion failed on a page that was showing
    // the attribution correctly.
    await expect(
      page.locator('[data-testid="role-row"]:visible').getByText(/BLS: .+ \(\d{2}-\d{4}\)/).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Bureau of Labor Statistics/ }),
    ).toBeVisible();
    await expect(page.getByText(/May \d{4}/).first()).toBeVisible();
  });

  test('sorting by median pay orders rows by their real figures', async ({ page }) => {
    await chooseFromSelect(page, 'Sort', 'Median pay');
    await expect(page.locator('[data-testid="role-row"]:visible')).toHaveCount(FIRST_PAGE);

    // `:visible`, like every other locator here. getByTestId picked up both
    // presentations — 18 bands for 9 rows — which broke the length assertion
    // below and left the ordering unchecked.
    const medians = await page
      .locator('[data-testid="wage-band"]:visible')
      .evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-median'))));

    expect(medians.length).toBe(FIRST_PAGE);
    const sorted = [...medians].sort((a, b) => b - a);
    expect(medians).toEqual(sorted);
  });

  test('the salary filter uses the BLS median, not prose', async ({ page }) => {
    await chooseFromSelect(page, 'Salary Range', 'Over $120k');

    const shown = Number((await page.getByTestId('role-count').textContent())!.match(/^(\d+)/)![1]);
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(TOTAL_ROLES);

    // `:visible`, like every other locator here. getByTestId picked up both
    // presentations, so this read each median twice — harmless for a
    // per-element bound, wrong for the same reason as the sort test above.
    const medians = await page
      .locator('[data-testid="wage-band"]:visible')
      .evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-median'))));
    for (const m of medians) expect(m).toBeGreaterThan(120000);
  });
});
