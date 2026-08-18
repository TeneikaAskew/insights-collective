// Tests written against the two failures this code exists to prevent:
//   1. assistant-ai turned a 429 into a bare 500 ("The AI service is currently
//      unavailable") and threw the work away.
//   2. A wait shorter than Groq's per-minute window cannot clear a per-minute
//      limit, so a fast retry burns an attempt to be told the same thing.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseRateLimit, invokeWithBackoff, describeWait, MAX_ATTEMPTS } from '../rateLimitRetry';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

/** The shape supabase-js hands us on a non-2xx: body unread, on error.context. */
function httpError(status: number, body: unknown) {
  return { name: 'FunctionsHttpError', context: { status, json: async () => body } };
}

const rateLimited = (retryAfterMs = 0) =>
  httpError(429, { code: 'rate_limited', retryAfterMs, error: 'Rate limit reached.' });

beforeEach(() => invoke.mockReset());

describe('parseRateLimit', () => {
  it('reads a structured 429 from the function', async () => {
    expect(await parseRateLimit(rateLimited(5000))).toEqual({ retryAfterMs: 5000 });
  });

  it('returns null for an error with no context', async () => {
    expect(await parseRateLimit(new Error('boom'))).toBeNull();
  });

  it('returns null for a 500, so a real failure is never retried as a rate limit', async () => {
    expect(await parseRateLimit(httpError(500, { error: 'exploded' }))).toBeNull();
  });

  it('returns null for a 429 whose body we do not recognise', async () => {
    // An unreadable error must not be mistaken for a retryable one.
    expect(await parseRateLimit(httpError(429, { error: 'some upstream limit' }))).toBeNull();
  });

  it('returns null when the body is not JSON at all', async () => {
    const err = { context: { status: 429, json: async () => { throw new SyntaxError('bad'); } } };
    expect(await parseRateLimit(err)).toBeNull();
  });
});

describe('invokeWithBackoff', () => {
  it('returns data without waiting when the call succeeds', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const sleep = vi.fn();
    expect(await invokeWithBackoff('fn', { sleep })).toEqual({ ok: true });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a rate limit and returns the eventual success', async () => {
    invoke
      .mockResolvedValueOnce({ data: null, error: rateLimited() })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const sleep = vi.fn().mockResolvedValue(undefined);
    expect(await invokeWithBackoff('fn', { sleep })).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('waits a minute then two, never seconds', async () => {
    invoke.mockResolvedValue({ data: null, error: rateLimited() });
    const waits: number[] = [];
    const sleep = vi.fn(async (ms: number) => { waits.push(ms); });
    await expect(invokeWithBackoff('fn', { sleep })).rejects.toBeDefined();
    // A per-minute budget cannot clear in less than its window.
    expect(waits).toEqual([60_000, 120_000]);
  });

  it('makes exactly two client attempts beyond the first, for four total', async () => {
    invoke.mockResolvedValue({ data: null, error: rateLimited() });
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(invokeWithBackoff('fn', { sleep })).rejects.toBeDefined();
    // Two of the four attempts were spent inside the Edge Function.
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(MAX_ATTEMPTS).toBe(4);
  });

  it("honours the server's retryAfterMs when it exceeds the schedule", async () => {
    invoke.mockResolvedValue({ data: null, error: rateLimited(90_000) });
    const waits: number[] = [];
    const sleep = vi.fn(async (ms: number) => { waits.push(ms); });
    await expect(invokeWithBackoff('fn', { sleep })).rejects.toBeDefined();
    expect(waits[0]).toBe(90_000);
  });

  it('never shortens a wait to the server\'s number', async () => {
    // Groq reports when the token bucket refills, which is not when a request
    // our size will fit. Trusting a 2s retry-after here would waste an attempt.
    invoke.mockResolvedValue({ data: null, error: rateLimited(2_000) });
    const waits: number[] = [];
    const sleep = vi.fn(async (ms: number) => { waits.push(ms); });
    await expect(invokeWithBackoff('fn', { sleep })).rejects.toBeDefined();
    expect(waits[0]).toBe(60_000);
  });

  it('throws a non-rate-limit error immediately without burning three minutes', async () => {
    const boom = httpError(500, { error: 'exploded' });
    invoke.mockResolvedValue({ data: null, error: boom });
    const sleep = vi.fn();
    await expect(invokeWithBackoff('fn', { sleep })).rejects.toBe(boom);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('announces each wait with the attempts remaining', async () => {
    invoke.mockResolvedValue({ data: null, error: rateLimited() });
    const onWait = vi.fn();
    await expect(
      invokeWithBackoff('fn', { sleep: vi.fn().mockResolvedValue(undefined), onWait }),
    ).rejects.toBeDefined();
    expect(onWait.mock.calls.map(([w]) => w)).toEqual([
      { attempt: 1, waitMs: 60_000, remaining: 1 },
      { attempt: 2, waitMs: 120_000, remaining: 0 },
    ]);
  });

  it('signals the retry so the UI can clear its notice', async () => {
    invoke
      .mockResolvedValueOnce({ data: null, error: rateLimited() })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const onRetry = vi.fn();
    await invokeWithBackoff('fn', { sleep: vi.fn().mockResolvedValue(undefined), onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('passes the body through unchanged', async () => {
    invoke.mockResolvedValueOnce({ data: {}, error: null });
    await invokeWithBackoff('fn', { body: { id: 7 } });
    expect(invoke).toHaveBeenCalledWith('fn', { body: { id: 7 } });
  });
});

describe('describeWait', () => {
  it('renders the two scheduled waits the way a person would say them', () => {
    expect(describeWait(60_000)).toBe('1 minute');
    expect(describeWait(120_000)).toBe('2 minutes');
  });

  it('stays in seconds below the minute-and-a-half mark', () => {
    expect(describeWait(45_000)).toBe('45 seconds');
  });
});
