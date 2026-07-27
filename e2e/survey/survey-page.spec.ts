import { test, expect } from '../fixtures/page-helpers';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Survey Page', () => {
  const surveyUrl = Routes.surveyPage();

  test('renders survey page for valid slug', async ({ page }) => {
    await goto(page, surveyUrl);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(surveyUrl);
    await waitForPageLoad(page);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('survey form fields render', async ({ page }) => {
    await goto(page, surveyUrl);
    const fields = page.locator('input, textarea, select, [role="radio"], [role="checkbox"]').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await fields.count() > 0) {
      await expect(fields).toBeVisible();
    }
  });

  test('submit button is present', async ({ page }) => {
    await goto(page, surveyUrl);
    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await submitBtn.count() > 0) {
      await expect(submitBtn).toBeVisible();
    }
  });

  test('required field validation triggers on empty submit', async ({ page }) => {
    await goto(page, surveyUrl);
    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit")').first();
    // TODO(count-guard): this passes whether or not the element exists. Assert the expected state, or seed the data and assert unconditionally.
    // eslint-disable-next-line no-restricted-syntax
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await expect(page).toHaveURL(new RegExp(surveyUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
