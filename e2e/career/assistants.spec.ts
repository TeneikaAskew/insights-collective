import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';
import { stopAtGuard } from '../helpers/visibility-helpers';

// Every test in this file passed while /assistants was switched off, because
// ComingSoon satisfies all of them: it renders inside AppLayout so `main` and
// the sidebar are present, its "Coming Soon" h2 satisfies `h1, h2`, it has no
// spinners, and the three count-guards matched nothing and no-op'd. Seven green
// tests, none of them about assistants.
//
// stopAtGuard asks the live configuration which render is correct and asserts
// the gate when the section is hidden. Neither branch passes by default, and
// restoring the section turns the content assertions back on with no code
// change here.
test.describe('Assistants', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.assistants);
  });

  test('renders assistants page', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.assistants);
    await waitForPageLoad(page);
    // True of the gate and of the page alike, so it needs no branch.
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('assistant cards are visible', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;
    // The count-guard here was never needed: the page renders from the static
    // allAssistants list (src/data/assistantData.ts, 14 entries), not from
    // seeded data, so "no cards" is a defect rather than a data gap.
    //
    // The locator is a testid because the obvious CSS guesses are all wrong:
    // AssistantCard is a plain div with `bg-card`, and `[class*="Card"]` is
    // case-sensitive, so the old selector matched nothing whatsoever. Behind a
    // count-guard that was invisible; unguarded it would have failed the moment
    // the section was restored, which is the worst possible time to find out.
    await expect(page.getByTestId('assistant-card').first()).toBeVisible();
  });

  test('tabs filter assistants by category', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;

    // Scoped to the visible tab panel, for two separate reasons. Radix keeps
    // every TabsContent mounted and hides the inactive ones, so an unscoped
    // count returns all four panels at once; and the page renders a FEATURED
    // Career Explorer card outside the tabs entirely (Assistants.tsx), which
    // would otherwise be counted in every tab's total.
    const panelCards = page.locator('[role="tabpanel"]:visible [data-testid="assistant-card"]');
    const panelNames = page.locator('[role="tabpanel"]:visible [data-testid="assistant-card"] h3');

    // "All Assistants" is the DEFAULT tab, so clicking it proves nothing — the
    // previous version clicked exactly that and could not tell working category
    // filtering from none at all. 13 = allAssistants (the featured card is not
    // in the array).
    await expect(panelCards).toHaveCount(13);

    await page.getByRole('tab', { name: 'Analytics' }).click();

    // The two analytics entries in assistantData.ts. Asserting names as well as
    // count, so a filter returning the wrong two still fails.
    await expect(panelCards).toHaveCount(2);
    await expect(panelNames).toHaveText(['Data Analyst', 'Project Dashboard']);
  });

  test('Launch button navigates to assistant interface', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;
    const launchBtn = page
      .locator('button:has-text("Launch"), button:has-text("Start"), a:has-text("Launch")')
      .first();
    await expect(launchBtn).toBeVisible();
  });

  test('page heading is visible', async ({ page }) => {
    if (await stopAtGuard(page, Routes.assistants)) return;
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    // Deliberately NOT guarded: the sidebar belongs to AppLayout, which wraps
    // the gate as well as the page, so this claim holds either way.
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
  });
});
