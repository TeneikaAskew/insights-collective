// ABOUTME: Journey J0 (UNRUN): before the instructor publishes, the learner cannot discover or enroll in the draft course
// ABOUTME: through the UI, and no enrollment write is sent. Read-only for the learner.
//
// Honest limit: this is a UI observation only. The enrollments INSERT policy in the schema snapshot checks only
// auth.uid() = user_id (scripts/local-stack/schema/04_rls_policies.sql: "Users can enroll themselves"), so a direct
// API insert into a draft course is NOT known to be refused. The journey does not probe that (no API shortcuts); it is
// recorded in PROPOSAL.md as an observed source gap, not fixed here.
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, route } from './ids';
import { appCall, countCalls, shot } from './observe';

test.describe.configure({ mode: 'serial' });

test('J0a catalog: the draft course is not listed for the learner', async ({ page }, info) => {
  await page.goto(route.catalog);
  await waitForPageLoad(page);
  await expect(page.getByText(J.title.course, { exact: true }).filter({ visible: true })).toHaveCount(0);
  await shot(page, info, 'J0a-catalog-before-publish');
});

test('J0b detail: the draft course offers no enroll control and no enrollment write is sent', async ({ page }, info) => {
  const writes = await countCalls(page, appCall('POST', '/rest/v1/enrollments'), async () => {
    await page.goto(route.detail);
    await waitForPageLoad(page);
    await expect(page.getByRole('button', { name: /Enroll for free/ })).toHaveCount(0);
  });
  expect(writes, 'no enrollment write before publish').toBe(0);
  await shot(page, info, 'J0b-detail-before-publish');
});
