// ABOUTME: Instructor persona (e2e-instructor, owner of RR and RR_EMPTY): exact Students/Reports values against the
// ABOUTME: hand oracle, denominator scope, unknown state, and denial for a course another instructor owns.
// Titles start with a fixed case id (RR-xx); run.sh's summary checks the exact case inventory by those ids only.
import { test, expect, apiAsPage } from './guarded-test';
import * as X from './expected';
import { assertRrReports, assertRrStudents, kpiValue, roster, rosterRow, waitForReports, waitForStudents } from './helpers';

const { builder, EMPTY, RR } = X;

test('RR-I1 Students: exact headline values and every row from progression evidence', async ({ page }) => {
  await page.goto(builder(RR.course, 'students'));
  await waitForStudents(page);
  await assertRrStudents(page, X);
});

test('RR-I2 Students: Needs attention shows exactly the learner flagged by exact count', async ({ page }) => {
  await page.goto(builder(RR.course, 'students'));
  await waitForStudents(page);
  await page.getByRole('button', { name: 'Needs attention' }).click();
  await expect(roster(page).getByRole('listitem')).toHaveCount(1);
  await expect(rosterRow(page, 'Alan Fixture')).toHaveCount(1);
});

test('RR-I3 Reports: exact KPIs and module progression over published sections only', async ({ page }) => {
  await page.goto(builder(RR.course, 'reports'));
  await waitForReports(page);
  await assertRrReports(page, X);
});

test('RR-I4 Unknown: a course with no published lessons shows a dash, never 0%', async ({ page }) => {
  await page.goto(builder(RR.empty, 'students'));
  await waitForStudents(page);
  await expect(kpiValue(page, 'Enrolled')).toHaveText(EMPTY.enrolled);
  // Exactly the two enrolled learners and two progress cells exist before any dash is checked.
  await expect(roster(page).getByRole('listitem')).toHaveCount(2);
  const cells = roster(page).locator('span[title]');
  await expect(cells).toHaveCount(2);
  await expect(cells.nth(0)).toHaveText(EMPTY.unknown);
  await expect(cells.nth(1)).toHaveText(EMPTY.unknown);
  await expect(page.getByTestId('roster-avg-progress')).toHaveText(EMPTY.unknown);
  await expect(page.getByText(EMPTY.studentsNote)).toBeVisible();
  await expect(kpiValue(page, 'Not started after 7 days')).toHaveText(EMPTY.notStarted);
  await expect(roster(page).getByText('Not started', { exact: true })).toHaveCount(0);

  await page.goto(builder(RR.empty, 'reports'));
  await waitForReports(page);
  await expect(kpiValue(page, 'Enrolled')).toHaveText(EMPTY.enrolled);
  await expect(kpiValue(page, 'Completion rate')).toHaveText(EMPTY.unknown);
  await expect(kpiValue(page, 'Average progress')).toHaveText(EMPTY.unknown);
  await expect(page.getByText(EMPTY.unknownCopy)).toHaveCount(2);
});

test('RR-I5 Denied: another instructor\'s course shows Not authorized and its rows are unreadable', async ({ page }) => {
  await page.goto(builder(RR.other, 'students'));
  await expect(page.getByRole('heading', { name: 'Not authorized' })).toBeVisible();
  await expect(page.getByText('Grace Fixture')).toHaveCount(0);
  // The UI gate is not the boundary: RLS must return zero rows for this course and its lesson (a canary row exists).
  expect(await apiAsPage(page, `enrollments?course_id=eq.${RR.other}&select=id`)).toEqual([]);
  expect(await apiAsPage(page, `content_item_progressions?content_item_id=eq.${RR.item.I8}&select=id`)).toEqual([]);
});
