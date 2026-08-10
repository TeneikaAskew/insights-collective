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

  test('light is the default even when the OS prefers dark', async ({ page }) => {
    // `defaultTheme` moved from "system" to "light" in d2694680: following the
    // OS put first-time visitors straight into dark mode, and light is the
    // intended default. This spec previously asserted the old behaviour and had
    // been failing on main ever since.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('the menu offers light and dark only', async ({ page }) => {
    // System was removed: it followed the OS rather than the choice, which read
    // as the toggle not working. The assertion is on the whole menu rather than
    // on System's absence alone, so an accidental third option fails here too.
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    await page.getByTestId('theme-toggle').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Light', 'Dark']);
  });

  test('a browser still holding the old System choice lands on light', async ({ page }) => {
    // The option is gone from the menu, but `ic-theme: "system"` is still in the
    // localStorage of everyone who picked it. Left there it names a theme that
    // no longer resolves, and no menu entry can clear it — so main.tsx rewrites
    // it before the provider reads it. Emulated dark, because following the OS
    // is exactly the behaviour that must not survive.
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
    await page.getByRole('menuitem', { name: /dark/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    // deep ink — hsl(257 14% 10%), ≈#18161D off the reference #17151C by
    // HSL rounding
    expect(bg).toBe('rgb(24, 22, 29)');
  });
});
