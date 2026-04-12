import { Page, expect } from '@playwright/test';
import { waitForPageLoad, expectToast, expectRedirectToLogin, clickTab, interceptOAuth } from '../helpers/wait-helpers';

export { waitForPageLoad, expectToast, expectRedirectToLogin, clickTab, interceptOAuth };

/**
 * Navigate to a URL and wait for page to fully load (spinner gone).
 */
export async function goto(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await waitForPageLoad(page);
}

/**
 * Assert a heading with the given text is visible on the page.
 */
export async function expectHeading(page: Page, text: string): Promise<void> {
  await expect(
    page.locator(`h1, h2, h3`).filter({ hasText: text }).first(),
  ).toBeVisible();
}

/**
 * Fill a form and click a submit button.
 */
export async function fillAndSubmit(
  page: Page,
  fields: Record<string, string>,
  submitSelector: string,
): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    await page.fill(selector, value);
  }
  await page.click(submitSelector);
}

/**
 * Assert no JavaScript errors occurred (checks console).
 * Call this at the end of a test to catch runtime errors.
 */
export function watchConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return () => errors;
}
