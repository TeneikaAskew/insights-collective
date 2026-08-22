// ABOUTME: Pulls the human-readable `error` an Edge Function put in its body.
// ABOUTME: supabase-js buries that body, unread, on `error.context` for non-2xx.
//
// Edge functions in this project report failures as `{ error: "..." }`, but
// FunctionsHttpError's own message is always the fixed "Edge Function returned
// a non-2xx status code" — so a toast built from `error.message` told the user
// "an error occurred" while the actual reason ("The job site responded with
// 502 Bad Gateway…") was discarded. Same body-on-context shape that
// parseRateLimit in rateLimitRetry.ts reads.
//
// Returns null when there is no readable server message, so callers keep
// their own generic fallback copy. Note the body can be read only once.

export async function functionErrorMessage(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context) return null;

  // FunctionsHttpError: context is the raw Response, unread.
  const response = context as Response;
  if (typeof response.json !== 'function') return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const message = (body as { error?: unknown })?.error;
  return typeof message === 'string' && message.trim() ? message : null;
}
