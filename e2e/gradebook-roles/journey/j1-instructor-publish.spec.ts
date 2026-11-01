// ABOUTME: Journey J1 (UNRUN): the instructor publishes the seeded draft course from the builder's own Publish control.
// ABOUTME: Checks the exact PATCH the app sent (published + legacy status mirror) and the one row the API returned, then a reload.
import { test, expect } from '../guarded-test';
import { waitForPageLoad } from '../../fixtures/page-helpers';
import { J, route } from './ids';
import { uiWrite, oneRow, shot } from './observe';

test.describe.configure({ mode: 'serial' });

test('J1 builder Publish: one PATCH to this course, published=true and status=published persisted, reload shows Unpublish', async ({ page }, info) => {
  await page.goto(route.builder);
  await waitForPageLoad(page);
  const publish = page.locator('[data-onboarding="builder-publish"]');
  await expect(publish).toHaveText('Publish');
  await shot(page, info, 'J1-builder-draft');

  const res = await uiWrite(page, () => publish.click(), 'PATCH', '/rest/v1/courses', `id=eq.${J.course}`);
  const sent = res.request().postDataJSON();
  expect(sent.published).toBe(true);
  expect(sent.status).toBe('published');
  const row = await oneRow(res, 'course publish');
  expect(row.id).toBe(J.course);
  expect(row.published).toBe(true);
  expect(row.status).toBe('published');
  await expect(page.getByText('Course published').first()).toBeVisible();

  await page.goto(route.builder);
  await waitForPageLoad(page);
  await expect(page.locator('[data-onboarding="builder-publish"]')).toHaveText('Unpublish');
  await shot(page, info, 'J1-builder-published-after-reload');
});
