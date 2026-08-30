// ABOUTME: One Groq call path for every function that talks to Groq.
// ABOUTME: Retries a 429 briefly in-process, then hands the wait to the client.
//
// WHY THE LONG WAIT IS NOT IN HERE
//
// The free tier's binding limit is tokens per minute, not requests: 8,000 TPM
// for openai/gpt-oss-120b. A single assistant-ai turn asks for up to 4,096, so
// two overlapping users are enough to trip it. Groq answers 429 with a
// `retry-after` that is usually a second or two — genuinely "try again in a
// moment" — and retrying that in-process is invisible to the user and worth
// doing.
//
// Waiting a *minute* in here is not. Supabase kills a request that has sent no
// response after 150s (Request idle timeout -> 504), and generate-study-guide
// already spends ~18s on real work before it ever reaches this code. Two
// minute-long pauses would exhaust that budget and replace a slow answer with a
// gateway error — and the user would watch a dead spinner the whole time,
// because a function that is sleeping cannot tell them why.
//
// So the split is deliberate:
//
//   attempts 1-2  here, seconds apart, silent           (this module)
//   attempts 3-4  in the browser, minutes apart, visible (src/lib/rateLimitRetry.ts)
//
// which is why exhausting the quick retries returns a *structured* 429 rather
// than throwing. The body carries `retryAfterMs` so the client knows how long
// to wait instead of guessing, and `code: "rate_limited"` so it can tell a
// budget problem from a real failure. Before this existed, assistant-ai turned
// a 429 into a bare 500 and the user was told "The AI service is currently
// unavailable" — which was both unhelpful and untrue.

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Attempts 3 and 4 belong to the client, so two is the whole in-process budget.
const QUICK_RETRIES = 2;

// Groq's retry-after is normally 1-3s. Cap it so a pathological value cannot
// push us toward the 150s idle timeout; anything longer is the client's job.
const MAX_QUICK_WAIT_S = 8;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GroqRateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("Groq rate limit reached");
    this.name = "GroqRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

function retryAfterMsFrom(response: Response, fallbackS: number): number {
  // Groq sends fractional seconds ("2.265"), which parseInt would truncate.
  const raw = Number(response.headers.get("retry-after"));
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : fallbackS;
  return Math.ceil(seconds * 1000);
}

/**
 * POST to Groq, retrying a 429 a couple of times in-process.
 *
 * Throws GroqRateLimitError once the quick retries are spent, so the caller can
 * answer 429 with rateLimitResponse() instead of collapsing it into a 500.
 */
export async function callGroq(
  apiKey: string,
  body: Record<string, unknown>,
  label: string,
  // Guards against a hung connection. Applied per attempt, not to the loop:
  // assistant-ai used to abort the whole call at 15s, which would have fired
  // mid-backoff and turned a retryable 429 into a spurious abort.
  perAttemptTimeoutMs = 30_000,
): Promise<any> {
  let response!: Response;

  // Groq's constrained decoder sometimes fails its own schema check and answers
  // 400 `json_validate_failed` — observed twice in fifteen calibration calls
  // against evaluate-star-response's json_schema format, e.g. emitting a
  // top-level array. It is a sampling accident, not a property of the request:
  // the identical request succeeds on resubmission. One retry, separate from
  // the 429 budget, keeps that accident from surfacing as "AI API error: 400".
  //
  // "Separate" is why the counters are separate: a shared loop counter would
  // spend one of the two quick 429 retries on the schema resample, handing the
  // wait back to the client one attempt early whenever both failures occur in
  // the same call.
  let schemaRetrySpent = false;
  let rateLimitWaits = 0;

  for (;;) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), perAttemptTimeoutMs);
    try {
      response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 400 && !schemaRetrySpent) {
      // Read the body to tell a decode accident from a genuinely bad request;
      // Response bodies are single-use, so a non-matching 400 re-throws from
      // the text already in hand rather than falling through to the reader
      // below.
      const detail = await response.text();
      if (detail.includes("json_validate_failed")) {
        schemaRetrySpent = true;
        console.warn(`[${label}] constrained decode failed schema validation, retrying once`);
        continue;
      }
      console.error(`[${label}] Groq error 400:`, detail);
      throw new Error(`AI API error: 400`);
    }

    if (response.status !== 429) break;

    if (rateLimitWaits >= QUICK_RETRIES) {
      // Hand the client the server's own number rather than a guess. 60s is the
      // fallback because the limit is per *minute*: if Groq declined to say,
      // one full window is the shortest wait that can actually clear it.
      const retryAfterMs = retryAfterMsFrom(response, 60);
      console.warn(`[${label}] rate limited after ${rateLimitWaits + 1} attempts, deferring ${retryAfterMs}ms to client`);
      throw new GroqRateLimitError(retryAfterMs);
    }

    rateLimitWaits++;
    const waitMs = Math.min(retryAfterMsFrom(response, 2), MAX_QUICK_WAIT_S * 1000);
    console.warn(`[${label}] rate limited, quick retry ${rateLimitWaits}/${QUICK_RETRIES} in ${waitMs}ms`);
    await sleep(waitMs);
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error(`[${label}] Groq error ${response.status}:`, detail);
    throw new Error(`AI API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * The 429 the client's retry helper knows how to read. Every field is load
 * bearing: `code` distinguishes a budget problem from a failure, `retryAfterMs`
 * sizes the wait, and `error` is the string an older caller would surface.
 */
export function rateLimitResponse(
  err: GroqRateLimitError,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      code: "rate_limited",
      retryAfterMs: err.retryAfterMs,
      error: "Rate limit reached. Waiting for the model's per-minute budget to reset.",
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(err.retryAfterMs / 1000)),
      },
    },
  );
}
