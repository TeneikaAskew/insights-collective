// ABOUTME: The `test` every builder-authoring spec uses: the shared console-error fixture plus the gradebook lane's AUTO
// ABOUTME: origin guard (reused unchanged), approving only the loopback app and API origins from the strict binding.
import { test as base, expect } from '../fixtures/page-helpers';
import { installOriginGuard } from '../gradebook-roles/origin-guard.mjs';
import { assertStrictLocalBinding } from '../gradebook-roles/local-binding.mjs';

export const BINDING = assertStrictLocalBinding();

export const test = base.extend<{ originGuard: Array<{ origin: string; kind: string }> }>({
  originGuard: [async ({ context }, use) => {
    const blocked = await installOriginGuard(context, [BINDING.app.origin, BINDING.api.origin]);
    await use(blocked);
    expect(blocked, 'requests to non-approved origins (each was blocked before it was sent)').toEqual([]);
  }, { auto: true }],
});
export { expect };
