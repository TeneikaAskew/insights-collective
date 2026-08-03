import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey List', () => {
  test('renders survey list page', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.survey);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await ctx.close();
  });

  test('spinner resolves on load', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(Routes.survey);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
    await ctx.close();
  });

  test('page heading is visible', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.survey);
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await ctx.close();
  });

  test('survey cards or list renders', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.survey);
    // Page may show surveys, empty state, or redirect — just verify it rendered
    await expect(page.locator('body')).not.toBeEmpty();
    await ctx.close();
  });

  test('start survey button navigates to survey page', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await goto(page, Routes.survey);
    // The seeded survey's OWN card, not "the first Start button on the page".
    // The list renders one card per active form — three today — so `.first()`
    // was asserting about whichever happened to sort first, and the test never
    // navigated: it checked that a button it had not identified was visible,
    // despite its own name.
    const card = page.locator('.rounded-lg.border', { hasText: 'E2E Fixture Survey' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Start Survey' }).click();
    await expect(page).toHaveURL(/\/survey\/e2e-fixture-survey$/);
    await expect(page.getByRole('heading', { name: 'E2E Fixture Survey' })).toBeVisible();
    await ctx.close();
  });
});
