import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Admin Forms Management', () => {
  test('renders admin forms page', async ({ page }) => {
    // /admin/forms was removed — use unified form management instead
    await goto(page, Routes.adminUnifiedFormManagement);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(Routes.adminUnifiedFormManagement);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('forms list renders', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);
    // The forms table by its own columns, and the seeded form in it. The old
    // locator ended in `[class*="Card"]`, which matches nothing — CSS attribute
    // substring matching is case-sensitive and shadcn's Card emits lowercase
    // utility classes — and began with `table`, so `.first()` resolved to
    // whichever came first in DOCUMENT order rather than selector order.
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    for (const column of ['Form Name', 'Status', 'Submissions', 'Last Updated', 'Actions']) {
      await expect(table.getByRole('columnheader', { name: column })).toBeVisible();
    }
    await expect(table.getByRole('row', { name: /E2E Fixture Survey/ })).toBeVisible();
  });

  // MEASURED: /admin/forms renders 0 [role="switch"] and 0 input[type=checkbox].
  // Status is a read-only table COLUMN; the per-row controls are Feature /
  // Unfeature / Edit / Preview / Delete. So there is no active-inactive toggle
  // to find, and the count-guard turned that into a pass.
  test.skip(
    'active/inactive toggle is present per form',
    {
      annotation: {
        type: 'skip-reason',
        description:
          'UI gap: /admin/forms has no per-form active/inactive control (0 [role="switch"], 0 checkboxes). Status is a read-only column; the row actions are Feature/Unfeature, Edit, Preview and Delete.',
      },
    },
    async ({ page }) => {
      await goto(page, Routes.adminUnifiedFormManagement);
      await expect(page.getByRole('switch').first()).toBeVisible();
    },
  );

  test('create form button opens the create dialog', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);
    // The control is called "New Form". The old locator's first alternative was
    // `button:has-text("Create")`, and `.first()` across the union meant the
    // test never established WHICH control it had found.
    const newForm = page.getByRole('button', { name: 'New Form' });
    await expect(newForm).toBeVisible();
    // And it does something — a button that renders but opens nothing is the
    // failure this file could not previously see.
    await newForm.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('page heading is visible', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);
    await expect(page.getByRole('heading', { name: 'Form Management' })).toBeVisible();
  });

  test('the three form tabs are offered', async ({ page }) => {
    await goto(page, Routes.adminUnifiedFormManagement);
    for (const tab of ['All Forms', 'Templates', 'Analytics']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
  });
});
