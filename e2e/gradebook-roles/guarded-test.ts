// ABOUTME: The `test` every gradebook-roles spec uses: the shared console-error fixture plus an AUTO origin guard on the
// ABOUTME: test's browser context (origin-guard.mjs). Any attempt to reach a non-approved origin is blocked before send and fails the test.
import { test as base, expect } from '../fixtures/page-helpers';
import { installOriginGuard } from './origin-guard.mjs';
import { BINDING } from './fixture';

export const test = base.extend<{ originGuard: Array<{ origin: string; kind: string }> }>({
  originGuard: [async ({ context }, use) => {
    const blocked = await installOriginGuard(context, [BINDING.app.origin, BINDING.api.origin]);
    await use(blocked);
    expect(blocked, 'requests to non-approved origins (each was blocked before it was sent)').toEqual([]);
  }, { auto: true }],
});
export { expect };
