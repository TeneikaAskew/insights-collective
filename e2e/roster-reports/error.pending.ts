// ABOUTME: PENDING (not in any default project): read-failure state via a per-test route that fails the progression read.
// ABOUTME: Per-test request injection is not yet a qualified technique in the isolated runner; enabled only by RR_ERROR_INJECTION=1.
// The page route answers a GET before it leaves the browser; the origin guard and request policy still cover every other
// request. As RR-P1 it counts only in the `pending` summary variant (cases.json pendingExtra), never in the default run.
import { test, expect } from './guarded-test';
import { builder, RR } from './expected';
import { waitForStudents } from './helpers';

test('RR-P1 Students shows an error with retry when the progression read fails, never zeros', async ({ page }) => {
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
