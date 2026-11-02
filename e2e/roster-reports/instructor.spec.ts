// ABOUTME: Instructor persona (e2e-instructor, owner of RR and RR_EMPTY): exact Students/Reports values against the
// ABOUTME: hand oracle, denominator scope, unknown state, and denial for a course another instructor owns.
import { test, expect, apiAsPage } from './guarded-test';
import { builder, EMPTY, FIXTURE_LEARNERS, LEGACY, MEMBER_ROW, REPORTS, RR, STUDENTS } from './expected';
import { kpiCard, kpiValue, roster, rosterRow, rowPct, waitForReports, waitForStudents } from './helpers';

test('Students: exact headline values and every row from progression evidence', async ({ page }) => {
  await page.goto(builder(RR.course, 'students'));
  await waitForStudents(page);
  // Scoped values first: these contradict what completion_status would give.
  await expect(kpiValue(page, 'Enrolled')).toHaveText(STUDENTS.enrolled);
  await expect(page.getByTestId('roster-avg-progress')).toHaveText(STUDENTS.avg);
  await expect(page.getByTestId('roster-avg-progress')).not.toHaveText(LEGACY.avg);
  await expect(kpiValue(page, 'Not started after 7 days')).toHaveText(STUDENTS.notStarted);
  await expect(roster(page).getByRole('listitem')).toHaveCount(5);
  for (const l of FIXTURE_LEARNERS) {
    const row = rosterRow(page, l.name);
    await expect(row).toHaveCount(1);
    await expect(rowPct(row)).toHaveText(l.pct);
    await expect(rowPct(row)).toHaveAttribute('title', l.title);
    await expect(row.getByText('Not started', { exact: true })).toHaveCount(l.notStarted ? 1 : 0);
  }
  // Denominator scope: the member finished I1 and also read I5 (unpublished) and I6 (draft section); only I1 counts.
  const member = roster(page).getByRole('listitem').filter({ has: page.locator(`span[title="${MEMBER_ROW.title}"]`) });
  await expect(member).toHaveCount(1);
  await expect(rowPct(member)).toHaveText(MEMBER_ROW.pct);
});

test('Students: Needs attention shows exactly the learner flagged by exact count', async ({ page }) => {
  await page.goto(builder(RR.course, 'students'));
  await waitForStudents(page);
  await page.getByRole('button', { name: 'Needs attention' }).click();
  await expect(roster(page).getByRole('listitem')).toHaveCount(1);
  await expect(rosterRow(page, 'Alan Fixture')).toHaveCount(1);
});

test('Reports: exact KPIs and module progression over published sections only', async ({ page }) => {
  await page.goto(builder(RR.course, 'reports'));
  await waitForReports(page);
  await expect(kpiValue(page, 'Enrolled')).toHaveText(REPORTS.enrolled);
  await expect(kpiValue(page, 'Completion rate')).toHaveText(REPORTS.completionRate);
  await expect(kpiValue(page, 'Completion rate')).not.toHaveText(LEGACY.completionRate);
  await expect(kpiValue(page, 'Average progress')).toHaveText(REPORTS.avg);
  await expect(kpiValue(page, 'Not started')).toHaveText(REPORTS.notStarted);
  await expect(kpiCard(page, 'Completion rate')).toContainText(REPORTS.completionCopy);
  const modules = page.getByRole('list', { name: 'Module progression' }).getByRole('listitem');
  await expect(modules).toHaveCount(REPORTS.modules.length);
  for (const m of REPORTS.modules) {
    const row = modules.filter({ hasText: m.title });
    await expect(row).toContainText(m.meta);
    await expect(row).toContainText(m.pct);
  }
  for (const t of REPORTS.absentModules) await expect(page.getByText(t)).toHaveCount(0);
});

test('Unknown: a course with no published lessons shows a dash, never 0%', async ({ page }) => {
  await page.goto(builder(RR.empty, 'students'));
  await waitForStudents(page);
  await expect(kpiValue(page, 'Enrolled')).toHaveText(EMPTY.enrolled);
  await expect(page.getByTestId('roster-avg-progress')).toHaveText(EMPTY.unknown);
  await expect(page.getByText(EMPTY.studentsNote)).toBeVisible();
  await expect(kpiValue(page, 'Not started after 7 days')).toHaveText(EMPTY.notStarted);
  for (const p of await roster(page).locator('span[title]').all()) await expect(p).toHaveText(EMPTY.unknown);
  await expect(roster(page).getByText('Not started', { exact: true })).toHaveCount(0);

  await page.goto(builder(RR.empty, 'reports'));
  await waitForReports(page);
  await expect(kpiValue(page, 'Completion rate')).toHaveText(EMPTY.unknown);
  await expect(kpiValue(page, 'Average progress')).toHaveText(EMPTY.unknown);
  await expect(page.getByText(EMPTY.unknownCopy)).toHaveCount(2);
});

test('Denied: another instructor\'s course shows Not authorized and its rows are unreadable', async ({ page }) => {
  await page.goto(builder(RR.other, 'students'));
  await expect(page.getByRole('heading', { name: 'Not authorized' })).toBeVisible();
  await expect(page.getByText('Grace Fixture')).toHaveCount(0);
  // The UI gate is not the boundary: RLS must return zero rows for this course and its lesson.
  expect(await apiAsPage(page, `enrollments?course_id=eq.${RR.other}&select=id`)).toEqual([]);
  expect(await apiAsPage(page, `content_item_progressions?content_item_id=eq.${RR.item.I8}&select=id`)).toEqual([]);
});
