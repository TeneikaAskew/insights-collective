import { test, expect, waitForPageLoad } from '../fixtures/page-helpers';

/**
 * The control is a single button now, not a menu. Light and dark were two of
 * three entries behind a dropdown; System was the third, and it followed the OS
 * rather than the choice just made. Pressing the icon is the whole interaction.
 */
test.describe('Ink Studio dark mode', () => {
  test('one press turns it dark, the next turns it back', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('the choice survives a reload', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await waitForPageLoad(page);
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('the button opens no menu and says what pressing it does', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    const toggle = page.getByTestId('theme-toggle');
    // Named for its destination: on a light page it offers dark.
    await expect(toggle).toHaveAttribute('aria-label', 'Switch to dark theme');

    await toggle.click();
    // A dropdown would have put menuitems on the page; a toggle must not.
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-label', 'Switch to light theme');
  });

  test('light is the default even when the OS prefers dark', async ({ page }) => {
    // `defaultTheme` moved from "system" to "light" in d2694680: following the
    // OS put first-time visitors straight into dark mode, and light is the
    // intended default.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('a browser still holding the old System choice lands on light', async ({ page }) => {
    // System is gone, but `ic-theme: "system"` is still in the localStorage of
    // everyone who picked it, and no control can clear it now — so main.tsx
    // rewrites it before the provider reads it. Emulated dark, because
    // following the OS is exactly what must not survive.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('ic-theme', 'system'));

    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await expect(page.locator('html')).not.toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('ic-theme'))).toBe('light');
  });

  test('dark theme applies the Ink Studio ground color', async ({ page }) => {
    // Selected explicitly rather than emulated: with a light default, an OS
    // preference alone no longer produces the dark ground, so emulating dark
    // would assert the light background against a dark expectation.
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    // deep ink — hsl(257 14% 10%), ≈#18161D off the reference #17151C by
    // HSL rounding
    expect(bg).toBe('rgb(24, 22, 29)');
  });
});
