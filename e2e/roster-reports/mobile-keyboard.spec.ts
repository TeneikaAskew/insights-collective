// ABOUTME: Instructor at 390x844: no horizontal page overflow on either tab, and the keyboard reaches the roster controls
// ABOUTME: in visual order (Open gradebook, search, sort, Needs attention, first View grades link).
import { test, expect } from './guarded-test';
import { builder, RR } from './expected';
import { waitForReports, waitForStudents } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

async function noHorizontalOverflow(page: import('@playwright/test').Page) {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll, 'page must not scroll horizontally at 390px').toBeLessThanOrEqual(inner);
}

test('Students at 390x844: values visible, no horizontal overflow, keyboard order', async ({ page }) => {
  await page.goto(builder(RR.course, 'students'));
  await waitForStudents(page);
  await expect(page.getByTestId('roster-avg-progress')).toBeVisible();
  await noHorizontalOverflow(page);
  await page.getByRole('link', { name: 'Open gradebook' }).focus();
  const order: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute('aria-label') || el?.textContent?.trim() || '';
    }));
  }
  expect(order[0]).toBe('Search students');
  expect(order[1]).toBe('Sort students');
  expect(order[2]).toBe('Needs attention');
  expect(order[3]).toMatch(/^View grades for /);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Needs attention' })).toHaveAttribute('aria-pressed', 'true');
});

test('Reports at 390x844: KPIs visible and no horizontal overflow', async ({ page }) => {
  await page.goto(builder(RR.course, 'reports'));
  await waitForReports(page);
  await expect(page.getByText('Completion rate', { exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
});
