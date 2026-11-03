// ABOUTME: Admin persona (e2e-admin, not the course instructor): the SAME exact Students and Reports assertions as the
// ABOUTME: instructor (shared helpers), so C8 claims full equality, not a subset.
import { test } from './guarded-test';
import * as X from './expected';
import { assertRrReports, assertRrStudents, waitForReports, waitForStudents } from './helpers';

test('RR-A1 Admin sees the RR roster and reports with the same exact values', async ({ page }) => {
  await page.goto(X.builder(X.RR.course, 'students'));
  await waitForStudents(page);
  await assertRrStudents(page, X);
  await page.goto(X.builder(X.RR.course, 'reports'));
  await waitForReports(page);
  await assertRrReports(page, X);
});
