// ABOUTME: Journey J1 (UNRUN): the instructor publishes the seeded draft course from the builder's own Publish control.
// ABOUTME: Exactly one PATCH to this course id (request level), published + legacy status mirror, one row back, reload shows Unpublish.
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, route } from './ids';
import { expectCalls, rowsOf, shot } from './observe';

test.describe.configure({ mode: 'serial' });

test('J1 builder Publish: one PATCH courses?id=eq.<course>, published=true and status=published persisted, reload shows Unpublish', async ({ page }, info) => {
  await page.goto(route.builder);
  await waitForPageLoad(page);
  const publish = page.locator('[data-onboarding="builder-publish"]');
  await expect(publish).toHaveText('Publish');
  await shot(page, info, 'J1-builder-draft');

  const [call] = await expectCalls(page, { method: 'PATCH', path: '/rest/v1/courses', query: { id: `eq.${J.course}` } }, () => publish.click(), { count: 1, status: [200] });
  const sent = call.req.postDataJSON();
  expect(sent.published).toBe(true);
  expect(sent.status).toBe('published');
  const rows = await rowsOf(call);
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(J.course);
  expect(rows[0].published).toBe(true);
  expect(rows[0].status).toBe('published');
  await expect(page.getByText('Course published').first()).toBeVisible();

  await page.goto(route.builder);
  await waitForPageLoad(page);
  await expect(page.locator('[data-onboarding="builder-publish"]')).toHaveText('Unpublish');
  await shot(page, info, 'J1-builder-published-after-reload');
});
