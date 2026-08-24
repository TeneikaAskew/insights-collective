// ABOUTME: Reads the model's reply — checks how generation ended before trusting
// ABOUTME: the content, so a truncated answer is reported as truncation.
// ABOUTME: Pure, so the failure branches are testable without a network call.

/**
 * A failure with a machine-readable `code`, so the client can tell a cut-off
 * evaluation from a broken one instead of showing the same
 * "Please try again" for both. Mirrors how `_shared/groq.ts` returns
 * `code: "rate_limited"`.
 */
export class EvaluationResponseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EvaluationResponseError";
    this.code = code;
  }
}

interface Usage {
  completion_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
}

/**
 * Pull the evaluation object out of a chat completion.
 *
 * `finish_reason` was never checked here. When the model ran out of budget the
 * content came back as a JSON fragment with no closing brace, the old
 * first-`{`-to-last-`}` salvage failed on it, and the user was told the response
 * could not be submitted — with no hint that the real problem was length. Each
 * ending now gets its own error.
 *
 * `maxTokens` is passed in only so the log can say what the ceiling was; a
 * truncation is not actionable without it.
 */
export function readEvaluation(result: unknown, maxTokens: number): Record<string, unknown> {
  const choice = (result as { choices?: Array<Record<string, unknown>> })?.choices?.[0];
  if (!choice) {
    console.error("[evaluate-star-response] No choices in model response:", result);
    throw new EvaluationResponseError("empty_response", "The model returned no response.");
  }

  const finishReason = choice.finish_reason;

  if (finishReason === "length") {
    const usage = (result as { usage?: Usage }).usage ?? {};
    console.error("[evaluate-star-response] Truncated at max_tokens", {
      max_tokens: maxTokens,
      completion_tokens: usage.completion_tokens,
      reasoning_tokens: usage.completion_tokens_details?.reasoning_tokens,
    });
    throw new EvaluationResponseError(
      "truncated",
      "The evaluation was cut off before it finished. Please try again.",
    );
  }

  if (finishReason !== "stop") {
    console.error(`[evaluate-star-response] Unexpected finish_reason: ${finishReason}`);
    throw new EvaluationResponseError(
      "unexpected_finish",
      `The model stopped unexpectedly (${finishReason}).`,
    );
  }

  const content = (choice.message as { content?: unknown } | undefined)?.content;
  if (typeof content !== "string" || content.trim() === "") {
    console.error("[evaluate-star-response] Model returned empty content");
    throw new EvaluationResponseError("empty_response", "The model returned an empty evaluation.");
  }

  // With a json_schema response format and finish_reason "stop", the content is
  // valid JSON by construction. Falling back to a regex that scrapes the first
  // `{` to the last `}` — which is what this used to do — would quietly re-admit
  // the malformed payloads the schema exists to prevent.
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    console.error("[evaluate-star-response] Schema-constrained output did not parse:", content);
    throw new EvaluationResponseError(
      "unparseable",
      error instanceof Error
        ? `The evaluation could not be read: ${error.message}`
        : "The evaluation could not be read.",
    );
  }
}
