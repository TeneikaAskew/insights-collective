// ABOUTME: The BLS wage data contract — the spec that catches an un-applied migration.
// ABOUTME: Asserts the figures reach the page and that every distribution is well formed.
import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

const TOTAL_ROLES = 33;
const FIRST_PAGE = 9;

test.describe('BLS wage data', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.exploreDataCareers);
    await waitForPageLoad(page);
    await expect(page.getByTestId('role-count')).toBeVisible();
    // Wage data arrives after first paint. Locator.all() and evaluateAll() do
    // not auto-retry, so anything reading attributes must wait for the bands
    // first or it races the query.
    await expect(page.getByTestId('wage-band')).toHaveCount(FIRST_PAGE);
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
    await expect(page.getByTestId('wage-band')).toHaveCount(FIRST_PAGE);
    await expect(page.getByTestId('wage-range')).toHaveCount(FIRST_PAGE);
  });

  test('percentiles are present and correctly ordered', async ({ page }) => {
    const bands = await page.getByTestId('wage-band').all();
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
    const band = page.getByTestId('wage-band').first();
    const p25 = Number(await band.getAttribute('data-pct25'));
    const p75 = Number(await band.getAttribute('data-pct75'));

    const printed = (await page.getByTestId('wage-range').first().textContent())!;
    expect(printed).toContain(`$${Math.round(p25 / 1000)}k`);
    expect(printed).toContain(`$${Math.round(p75 / 1000)}k`);
  });

  test('figures are attributed to a named BLS occupation', async ({ page }) => {
    // A pay figure with no source is the thing this whole feature exists to avoid.
    await expect(page.getByText(/BLS: .+ \(\d{2}-\d{4}\)/).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Bureau of Labor Statistics/ }),
    ).toBeVisible();
    await expect(page.getByText(/May \d{4}/).first()).toBeVisible();
  });

  test('sorting by median pay orders rows by their real figures', async ({ page }) => {
    await chooseFromSelect(page, 'Sort', 'Median pay');
    await expect(page.getByTestId('role-row')).toHaveCount(FIRST_PAGE);

    const medians = await page
      .getByTestId('wage-band')
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

    const medians = await page
      .getByTestId('wage-band')
      .evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-median'))));
    for (const m of medians) expect(m).toBeGreaterThan(120000);
  });
});
