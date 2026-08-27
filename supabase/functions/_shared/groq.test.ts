// ABOUTME: Spec for callGroq's 400-handling — a json_validate_failed decode
// ABOUTME: accident is retried exactly once; every other 400 fails fast.
// ABOUTME: Run: deno test --no-check --allow-env _shared/groq.test.ts

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { callGroq } from './groq.ts';

const VALIDATE_FAILED_BODY = JSON.stringify({
  error: {
    message: "Generated JSON does not match the expected schema. Please adjust your prompt.",
    type: 'invalid_request_error',
    code: 'json_validate_failed',
  },
});

const OK_BODY = JSON.stringify({ choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] });

/** Serve the queued responses in order, recording how many were consumed. */
function stubFetch(responses: Response[]) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    const next = responses[calls];
    calls++;
    if (!next) throw new Error(`fetch called ${calls} times, only ${responses.length} queued`);
    return Promise.resolve(next);
  };
  return {
    calls: () => calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

Deno.test('a json_validate_failed 400 is retried once and can succeed', async () => {
  const stub = stubFetch([
    new Response(VALIDATE_FAILED_BODY, { status: 400 }),
    new Response(OK_BODY, { status: 200 }),
  ]);
  try {
    const result = await callGroq('key', {}, 'test');
    assertEquals(stub.calls(), 2);
    assertEquals(result.choices[0].finish_reason, 'stop');
  } finally {
    stub.restore();
  }
});

Deno.test('a second json_validate_failed 400 is a real failure, not a loop', async () => {
  const stub = stubFetch([
    new Response(VALIDATE_FAILED_BODY, { status: 400 }),
    new Response(VALIDATE_FAILED_BODY, { status: 400 }),
  ]);
  try {
    await assertRejects(() => callGroq('key', {}, 'test'), Error, 'AI API error: 400');
    assertEquals(stub.calls(), 2);
  } finally {
    stub.restore();
  }
});

Deno.test('a 400 that is not a decode accident fails on the first attempt', async () => {
  const stub = stubFetch([
    new Response(JSON.stringify({ error: { code: 'model_decommissioned' } }), { status: 400 }),
  ]);
  try {
    await assertRejects(() => callGroq('key', {}, 'test'), Error, 'AI API error: 400');
    assertEquals(stub.calls(), 1);
  } finally {
    stub.restore();
  }
});
