// ABOUTME: Genuine end-to-end test for the notification center. Signs in as the
// ABOUTME: seeded test member, loads /notifications, and exercises mark-as-read,
// ABOUTME: delete, and dropdown filtering against real DB state.
import { test, expect, type Page } from '@playwright/test';

// The filter is a Radix Select: the trigger is a combobox, the choices are
// options that only exist in the DOM while the menu is open.
function filterTrigger(page: Page) {
  return page.getByRole('combobox', { name: /filter notifications/i });
}

async function chooseFilter(page: Page, name: RegExp) {
  await filterTrigger(page).click();
  await page.getByRole('option', { name }).click();
  await expect(page.getByRole('option', { name })).toBeHidden();
}

// This spec runs under the chromium-member project, whose storageState is the
// session global-setup already established, so it starts authenticated. Driving
// the real /login form in beforeEach was redundant work that could only add
// failure surface: when that login was slow or failed, the page sat on /login
// and every later locator timed out. Rely on the project session instead.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';


test.describe('Notifications center — real flow', () => {
  test('notification message spans the card width at phone width', async ({ page }) => {
    // The message used to live in the same column as the title, sharing that
    // column's width with a timestamp and a delete button. On a phone that left
    // it roughly half the card, so short messages wrapped to four lines while
    // the space beneath the icon stayed empty. Header row (icon, title, delete)
    // then a full-width body row is what this measures.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const cards = page.locator('[data-testid="notification-card"]');
    await expect
      .poll(
        async () => {
          const rendered = await cards.count();
          const empty = await page.getByText(/nothing here/i).isVisible().catch(() => false);
          return rendered > 0 ? 'cards' : empty ? 'empty' : 'loading';
        },
        { timeout: 20_000 },
      )
      .not.toBe('loading');

    const cardCount = await cards.count();
    expect(
      cardCount,
      'Seed gap: E2E member has no notifications, so this layout assertion measured nothing.',
    ).toBeGreaterThan(0);

    const card = cards.first();
    const cardBox = await card.boundingBox();
    // The message is the last <p> in the card body, outside the header row.
    const message = card.locator('p').last();
    const messageBox = await message.boundingBox();

    expect(cardBox && messageBox, 'card and message both have layout boxes').toBeTruthy();
    expect(
      messageBox!.width,
      `Message is ${Math.round(messageBox!.width)}px wide inside a ${Math.round(cardBox!.width)}px ` +
        'card — it is still boxed into the title column rather than spanning the card.',
    ).toBeGreaterThan(cardBox!.width * 0.8);

    // The title gets the full width beside the icon now, so it should not be
    // clipped down to a couple of words with an ellipsis.
    const heading = card.locator('h4').first();
    const clipped = await heading.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped, 'notification title is still being clipped horizontally').toBe(false);
  });


  test('renders header, filter dropdown, and either items or empty state', async ({ page }) => {
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible();
    await expect(filterTrigger(page)).toBeVisible();

    // "All" is the default selection, and the menu offers at least All + Unread.
    await expect(filterTrigger(page)).toContainText('All');
    await filterTrigger(page).click();
    await expect(page.getByRole('option', { name: /^All/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /^Unread/ })).toBeVisible();
    await page.keyboard.press('Escape');

    // Wait for the fetch to settle: either an item card renders or the "Nothing here" empty state does.
    await expect
      .poll(async () => {
        const empty = await page.getByText(/nothing here/i).isVisible().catch(() => false);
        const cards = await page.locator('[class*="border-l-primary"], .cursor-pointer:has(h4)').count();
        return empty || cards > 0;
      }, { timeout: 10_000 })
      .toBe(true);
  });

  test('Mark all as read clears the unread badge in the DB round-trip', async ({ page }) => {
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const markAllBtn = page.getByRole('button', { name: /mark all as read/i });
    // If the button is enabled, at least one unread exists → clicking must clear the Unread badge.
    if (await markAllBtn.isEnabled().catch(() => false)) {
      await markAllBtn.click();
      // The unread badge (a small pill) should disappear; button becomes disabled.
      await expect(markAllBtn).toBeDisabled({ timeout: 5_000 });
      await chooseFilter(page, /^Unread/);
      await expect(page.getByText(/nothing here/i)).toBeVisible({ timeout: 5_000 });

      // Reload from server — should still show no unread (persisted, not just local state).
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      await chooseFilter(page, /^Unread/);
      await expect(page.getByText(/nothing here/i)).toBeVisible({ timeout: 5_000 });
    } else {
      // No unread — verify the disabled state and the Unread filter genuinely empty.
      await expect(markAllBtn).toBeDisabled();
      await chooseFilter(page, /^Unread/);
      await expect(page.getByText(/nothing here/i)).toBeVisible();
    }
  });

  test('Deleting a notification removes it from the list permanently', async ({ page }) => {
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const cardSel = '[data-testid="notification-card"]';

    // `networkidle` is not "rendered". This member holds 200+ notification rows,
    // and over the relay the app was still showing its boot spinner when the
    // count below ran — so the spec reported "seed gap: no notifications" for an
    // account that had 204 of them. Wait for the list to actually settle into
    // one of its two terminal states before counting.
    await expect
      .poll(
        async () => {
          const cards = await page.locator(cardSel).count();
          if (cards > 0) return 'cards';
          const empty = await page
            .getByText(/nothing here/i)
            .isVisible()
            .catch(() => false);
          return empty ? 'empty' : 'loading';
        },
        { timeout: 20_000 },
      )
      .not.toBe('loading');

    const initial = await page.locator(cardSel).count();
    expect(
      initial,
      'Seed gap: E2E member has no notifications. Reseed at least one notification row (e.g. announcement fan-out) for the member.',
    ).toBeGreaterThan(0);


    // Identify the row by its notification id, not by title+message.
    // Fan-out notifications repeat verbatim — this account currently holds 36
    // rows reading "Assignment graded: Python Data Analysis / Your submission
    // was graded." — so a title+message fingerprint matched the deleted row's
    // twins and the "it disappeared" poll could never go false. The id is
    // unique by construction.
    const firstCard = page.locator(cardSel).first();
    const targetId = await firstCard.getAttribute('data-notification-id');
    expect(targetId, 'notification card exposes its id').toBeTruthy();
    const target = page.locator(`[data-notification-id="${targetId}"]`);

    // The row leaves the list optimistically, before the DELETE is answered, so
    // the reload below has to be sequenced after the request rather than after
    // the disappearance. page.reload() aborts whatever is still in flight, and
    // over the relay the round trip is slow enough to lose the write: measured,
    // the notification came back on reload and was still in the table
    // afterwards, while the same delete performed as this user in SQL removed a
    // row. The test was asserting a race, not persistence.
    const deleteAccepted = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && r.url().includes('/rest/v1/notifications'),
      { timeout: 10_000 },
    );

    await firstCard.getByRole('button', { name: /delete notification/i }).click();

    // Optimistic removal: that exact row is gone.
    await expect(target).toHaveCount(0, { timeout: 5_000 });

    const response = await deleteAccepted;
    expect(
      response.status(),
      `DELETE /notifications answered ${response.status()}; the row was never removed server-side`,
    ).toBeLessThan(300);

    // Reload → persisted delete: that specific notification stays gone.
    // Checked by id, so a concurrently-arriving notification with the same
    // wording cannot make this pass or fail by accident.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`[data-notification-id="${targetId}"]`)).toHaveCount(0);
  });
});


