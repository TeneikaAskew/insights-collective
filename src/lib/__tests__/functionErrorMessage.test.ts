// Written against a real incident: scrape-job-description returned a 500 with
// { error: "Failed to fetch URL: Bad Gateway" } in the body, and the toast
// showed only "an error occurred" because supabase-js leaves that body unread
// on error.context and puts a fixed message on the error itself.

import { describe, it, expect } from 'vitest';
import { functionErrorMessage } from '../functionErrorMessage';

/** The shape supabase-js hands us on a non-2xx: body unread, on error.context. */
function httpError(status: number, body: unknown) {
  return { name: 'FunctionsHttpError', context: { status, json: async () => body } };
}

describe('functionErrorMessage', () => {
  it('reads the error string the function put in its body', async () => {
    const err = httpError(502, {
      error: 'The job site responded with 502 Bad Gateway. It may be temporarily unavailable — try again in a moment.',
    });
    expect(await functionErrorMessage(err)).toMatch(/502 Bad Gateway/);
  });

  it('returns null for an error with no context, like a plain Error', async () => {
    expect(await functionErrorMessage(new Error('boom'))).toBeNull();
    expect(await functionErrorMessage(null)).toBeNull();
  });

  it('returns null when the body carries no usable error string', async () => {
    expect(await functionErrorMessage(httpError(500, { message: 'nope' }))).toBeNull();
    expect(await functionErrorMessage(httpError(500, { error: '   ' }))).toBeNull();
    expect(await functionErrorMessage(httpError(500, { error: 42 }))).toBeNull();
  });

  it('returns null when the body is not JSON at all', async () => {
    const err = { context: { status: 502, json: async () => { throw new SyntaxError('bad'); } } };
    expect(await functionErrorMessage(err)).toBeNull();
  });
});
