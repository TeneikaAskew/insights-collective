// ABOUTME: PENDING (not in any default project): read-failure state via a per-test route that fails the progression read.
// ABOUTME: Per-test request injection is not yet a qualified technique in the isolated runner; enabled only by RR_ERROR_INJECTION=1.
import { test, expect } from './guarded-test';
import { builder, RR } from './expected';
import { waitForStudents } from './helpers';

test('Students shows an error with retry when the progression read fails, never zeros', async ({ page }) => {
  let fail = true;
  await page.route('**/rest/v1/content_item_progressions*', (route) =>
    fail ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"rr injected failure"}' }) : route.fallback());
  await page.goto(builder(RR.course, 'students'));
  await expect(page.getByRole('alert')).toContainText("Couldn't load students");
  await expect(page.getByTestId('roster-avg-progress')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await waitForStudents(page);
  await expect(page.getByTestId('roster-avg-progress')).toHaveText('35%');
});
