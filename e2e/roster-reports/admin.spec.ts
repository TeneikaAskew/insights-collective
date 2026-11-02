// ABOUTME: Admin persona (e2e-admin, not the course instructor): sees the same exact Students and Reports values.
import { test, expect } from './guarded-test';
import { builder, REPORTS, RR, STUDENTS } from './expected';
import { kpiValue, roster, waitForReports, waitForStudents } from './helpers';

test('Admin sees the RR roster and reports with the same exact values', async ({ page }) => {
  await page.goto(builder(RR.course, 'students'));
  await waitForStudents(page);
  await expect(kpiValue(page, 'Enrolled')).toHaveText(STUDENTS.enrolled);
  await expect(page.getByTestId('roster-avg-progress')).toHaveText(STUDENTS.avg);
  await expect(roster(page).getByRole('listitem')).toHaveCount(5);

  await page.goto(builder(RR.course, 'reports'));
  await waitForReports(page);
  await expect(kpiValue(page, 'Completion rate')).toHaveText(REPORTS.completionRate);
  await expect(kpiValue(page, 'Average progress')).toHaveText(REPORTS.avg);
  await expect(kpiValue(page, 'Not started')).toHaveText(REPORTS.notStarted);
});
