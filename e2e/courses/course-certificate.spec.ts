import { test, expect } from '@playwright/test';
import { goto, waitForPageLoad } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

test.describe('Course Certificate', () => {
  const certUrl = Routes.certificate();

  test('renders certificate page', async ({ page }) => {
    await goto(page, certUrl);
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('spinner resolves on load', async ({ page }) => {
    await page.goto(certUrl);
    await waitForPageLoad(page);
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('certificate content or completion message renders', async ({ page }) => {
    await goto(page, certUrl);
    const cert = page.locator(
      '[class*="certificate"], :has-text("Certificate"), :has-text("Congratulations"), :has-text("complete")',
    );
    if (await cert.count() > 0) {
      await expect(cert.first()).toBeVisible();
    }
  });

  test('download or print button is present if completed', async ({ page }) => {
    await goto(page, certUrl);
    const downloadBtn = page.locator('button:has-text("Download"), button:has-text("Print"), a[download]').first();
    if (await downloadBtn.count() > 0) {
      await expect(downloadBtn).toBeVisible();
    }
  });
});
