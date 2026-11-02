// ABOUTME: Page readers for the builder Students and Reports tabs: KPI value by its label, roster rows by learner name,
// ABOUTME: with visibility filters (responsive layouts may mount hidden copies).
import { expect, type Locator, type Page } from '@playwright/test';

/** The <dd> value of the KPI whose <dt> is exactly `label`. */
export function kpiValue(scope: Page | Locator, label: string): Locator {
  return scope.locator('dl > div:visible').filter({ has: scope.locator(`dt`, { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
}
export function kpiCard(scope: Page | Locator, label: string): Locator {
  return scope.locator('dl > div:visible').filter({ has: scope.locator('dt', { hasText: new RegExp(`^${label}$`) }) });
}
export function roster(page: Page): Locator {
  return page.getByRole('list', { name: 'Enrolled students' });
}
export function rosterRow(page: Page, name: string): Locator {
  return roster(page).getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) });
}
/** The progress text cell of a row (its title carries the exact counts). */
export function rowPct(row: Locator): Locator {
  return row.locator('span[title]');
}
export async function waitForStudents(page: Page) {
  await expect(page.getByRole('heading', { name: 'Students', level: 2 })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading students' })).toHaveCount(0);
}
export async function waitForReports(page: Page) {
  await expect(page.getByRole('heading', { name: 'Reports', level: 2 })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading reports' })).toHaveCount(0);
}
