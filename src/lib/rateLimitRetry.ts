// ABOUTME: Client half of the Groq rate-limit backoff — the long, visible waits.
// ABOUTME: Retries a structured 429 from an Edge Function up to two more times.
//
// The Edge Function has already tried twice, seconds apart, before any of this
// runs (supabase/functions/_shared/groq.ts explains why the long wait cannot
// live there: a request that sends nothing for 150s is killed as a 504). What
// is left is the part that has to be slow and has to be visible:
//
//   attempts 1-2  server, seconds apart, silent
//   attempts 3-4  here, a minute then two, announced via onWait
//
// The waits are long on purpose. Groq's limit is tokens *per minute*, so a
// wait shorter than the window cannot clear it — retrying after five seconds
// just spends another attempt to be told the same thing.

import { supabase } from '@/integrations/supabase/client';

/** Total attempts across both halves. Two are spent server-side before we see a 429. */
export const MAX_ATTEMPTS = 4;

/**
 * Waits for the client's two attempts. The server's `retryAfterMs` overrides
 * the first when Groq supplied one, but never downward — Groq reports when the
 * *token bucket* refills, which is not the same as when a request the size of
 * ours will fit.
 */
const CLIENT_WAITS_MS = [60_000, 120_000];

export interface RateLimitWait {
  /** 1-based index of the wait about to happen: 1 = the ~1 minute one, 2 = ~2 minutes. */
  attempt: number;
  /** How long we are about to wait, in ms. */
  waitMs: number;
  /** Attempts remaining after this one, so a caller can say "2 tries left". */
  remaining: number;
}

export interface InvokeWithBackoffOptions<T> {
  body?: unknown;
  /** Called immediately before each long wait — drive the countdown from this. */
  onWait?: (wait: RateLimitWait) => void;
  /** Called when a retry actually fires, so the UI can clear its notice. */
  onRetry?: () => void;
  /** Seam for tests; defaults to real time. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reads the structured 429 an Edge Function sends when its quick retries are
 * spent. Returns null for anything else, including a 429 with no body we
 * recognise — an unreadable error must not be mistaken for a retryable one.
 *
 * supabase-js does not give us the body on a non-2xx: `data` is null and the
 * response is buried on `error.context`. Every branch here is a shape that
 * error has actually taken.
 */
export async function parseRateLimit(error: unknown): Promise<{ retryAfterMs: number } | null> {
  const context = (error as { context?: unknown })?.context;
  if (!context) return null;

  // FunctionsHttpError: context is the raw Response, unread.
  const response = context as Response;
  if (typeof response.json !== 'function') return null;
  if (typeof response.status === 'number' && response.status !== 429) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const parsed = body as { code?: string; retryAfterMs?: unknown };
  if (parsed?.code !== 'rate_limited') return null;

  const fromServer = Number(parsed.retryAfterMs);
  return { retryAfterMs: Number.isFinite(fromServer) && fromServer > 0 ? fromServer : 0 };
}

/**
 * Invoke an Edge Function, absorbing rate limits with long visible waits.
 *
 * Resolves with the function's data, or throws the last error. A non-rate-limit
 * error is thrown immediately and unwrapped — retrying a real failure four
 * times only makes the user wait three minutes to see it.
 */
export async function invokeWithBackoff<T = unknown>(
  functionName: string,
  options: InvokeWithBackoffOptions<T> = {},
): Promise<T> {
  const { body, onWait, onRetry, sleep = realSleep } = options;

  for (let clientAttempt = 0; ; clientAttempt++) {
    const { data, error } = await supabase.functions.invoke(functionName, { body });

    if (!error) return data as T;

    const rateLimit = await parseRateLimit(error);
    if (!rateLimit) throw error;

    if (clientAttempt >= CLIENT_WAITS_MS.length) throw error;

    // Never wait less than the schedule says: a token bucket that has refilled
    // enough for a small request may still reject ours.
    const waitMs = Math.max(CLIENT_WAITS_MS[clientAttempt], rateLimit.retryAfterMs);

    onWait?.({
      attempt: clientAttempt + 1,
      waitMs,
      remaining: CLIENT_WAITS_MS.length - clientAttempt - 1,
    });

    await sleep(waitMs);
    onRetry?.();
  }
}

/**
 * "45 seconds" / "1 minute" / "2 minutes" — for the notice shown during a wait.
 *
 * The boundary is 60, not 90: the scheduled waits are exactly 60s and 120s, and
 * at 90 the first of them rendered as "60 seconds", which is true but reads
 * like a much shorter wait than the one about to happen.
 */
export function describeWait(waitMs: number): string {
  const seconds = Math.round(waitMs / 1000);
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}
