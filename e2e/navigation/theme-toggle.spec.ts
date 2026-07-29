import { test, expect, waitForPageLoad } from '../fixtures/page-helpers';

test.describe('Ink Studio dark mode', () => {
  test('toggle switches to dark and persists across reload', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await page.getByTestId('theme-toggle').click();
    await page.getByRole('menuitem', { name: /dark/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await waitForPageLoad(page);
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Back to light
    await page.getByTestId('theme-toggle').click();
    await page.getByRole('menuitem', { name: /light/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('system preference is honored by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await waitForPageLoad(page);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('dark theme applies the Ink Studio ground color', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    // deep ink — hsl(257 14% 10%), ≈#18161D off the reference #17151C by
    // HSL rounding
    expect(bg).toBe('rgb(24, 22, 29)');
  });
});
