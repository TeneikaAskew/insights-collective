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

/** C1-C3 exact Students assertions, shared by the instructor and admin personas (same oracle, same code). */
export async function assertRrStudents(page: Page, X: typeof import('./expected')) {
  await expect(kpiValue(page, 'Enrolled')).toHaveText(X.STUDENTS.enrolled);
  await expect(page.getByTestId('roster-avg-progress')).toHaveText(X.STUDENTS.avg);
  await expect(page.getByTestId('roster-avg-progress')).not.toHaveText(X.LEGACY.avg);
  await expect(kpiValue(page, 'Not started after 7 days')).toHaveText(X.STUDENTS.notStarted);
  await expect(roster(page).getByRole('listitem')).toHaveCount(5);
  for (const l of X.FIXTURE_LEARNERS) {
    const row = rosterRow(page, l.name);
    await expect(row).toHaveCount(1);
    await expect(rowPct(row)).toHaveText(l.pct);
    await expect(rowPct(row)).toHaveAttribute('title', l.title);
    await expect(row.getByText('Not started', { exact: true })).toHaveCount(l.notStarted ? 1 : 0);
  }
  // Denominator: the member finished I1 and also read I5 (unpublished) and I6 (draft section); only I1 counts.
  const member = roster(page).getByRole('listitem').filter({ has: page.locator(`span[title="${X.MEMBER_ROW.title}"]`) });
  await expect(member).toHaveCount(1);
  await expect(rowPct(member)).toHaveText(X.MEMBER_ROW.pct);
}

/** C5 exact Reports assertions, shared by the instructor and admin personas. */
export async function assertRrReports(page: Page, X: typeof import('./expected')) {
  await expect(kpiValue(page, 'Enrolled')).toHaveText(X.REPORTS.enrolled);
  await expect(kpiValue(page, 'Completion rate')).toHaveText(X.REPORTS.completionRate);
  await expect(kpiValue(page, 'Completion rate')).not.toHaveText(X.LEGACY.completionRate);
  await expect(kpiValue(page, 'Average progress')).toHaveText(X.REPORTS.avg);
  await expect(kpiValue(page, 'Not started')).toHaveText(X.REPORTS.notStarted);
  await expect(kpiCard(page, 'Completion rate')).toContainText(X.REPORTS.completionCopy);
  const modules = page.getByRole('list', { name: 'Module progression' }).getByRole('listitem');
  await expect(modules).toHaveCount(X.REPORTS.modules.length);
  for (const m of X.REPORTS.modules) {
    const row = modules.filter({ hasText: m.title });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(m.meta);
    await expect(row).toContainText(m.pct);
  }
  for (const t of X.REPORTS.absentModules) await expect(page.getByText(t)).toHaveCount(0);
}
