# Groq model decommission — audit and model comparison

**Date:** 2026-08-16 · **Status:** awaiting approval of outputs; no application code changed.

Groq notified that `llama-3.3-70b-versatile` is decommissioned on 2026-08-16, recommending
`openai/gpt-oss-120b` or `qwen/qwen3.6-27b`. This is the audit of what actually uses Groq
models here, and the measured difference between the models.

The email covers one model. The audit found **four** features on dead or dying Groq models, and
three of them have been broken since 2025-08-30.

## Call sites

| Feature | Source | Model | Status | Failure mode |
|---|---|---|---|---|
| Code Practice grading | `review-code/index.ts:16` | `llama-3.3-70b-versatile` | breaks at cutoff | hard 500 |
| Career assistant chat | `assistant-ai/index.ts:440` | `llama3-8b-8192` | **dead since 2025-08-30** | hard 500 |
| STAR interview feedback | `evaluate-star-response/index.ts:280` | `llama3-8b-8192` | **dead since 2025-08-30** | hard 500 |
| Study guide → assessment areas | `generate-study-guide/index.ts:127` | `llama3-8b-8192` | **dead since 2025-08-30** | *silent* — caught, guide generates without behavioural questions |
| Resume analyzer (Groq fallback) | `resume-analyzer/utils.ts:249` | `compound-beta-mini` | serving | legacy alias of `groq/compound-mini` |

Ten further AI call sites run on `google/gemini-2.5-flash` via the Lovable gateway and are unaffected.

### Live verification

- `review-code`'s deployed source matches the repo byte-for-byte (no drift). 63 calls in 24h;
  logs show successful parses through 2026-08-15, so the 70B was serving right up to the cutoff.
- Model probe against the live API: `llama3-8b-8192` returns HTTP 400 `model_decommissioned`.
  `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `qwen/qwen3.6-27b`, `llama-3.1-8b-instant`
  and `compound-beta-mini` all returned 200.
- `assistant_messages` shows no assistant reply persisted through `assistant-ai` since 2025-06-05.
  (Recent rows in that table come from `ResumeChat`, which writes the `model` column; `assistant-ai`
  leaves it null.) Last STAR feedback: 2025-05-30.

## Grading accuracy

Production data cannot answer this — 492 of 493 stored `code_attempts` are the identical empty
stub of one challenge. The suite in `scripts/model-migration/judge-suite.mjs` uses six submissions
across the real challenges where the correct verdict is unambiguous, run through the exact
production judge prompt.

| Model | Graded right | Parse failures | Avg latency | Avg output |
|---|---|---|---|---|
| `llama-3.3-70b-versatile` (current) | **4 / 6** | 0 | 865 ms | 293 tok |
| `openai/gpt-oss-120b` | **6 / 6** | 0 | 2,269 ms | 1,020 tok |
| `qwen/qwen3.6-27b` (JSON mode on) | 3 / 3 | 0 | 6,182 ms | 3,088 tok |
| `qwen/qwen3.6-27b` (as prod calls it) | — | **3 / 3 failed** | 2,684 ms | 1,221 tok |

The current model's two failures:

- **False pass** — a log parser using `>=` where it needed `>` was traced as fully correct.
- **False fail** — a correct solution returning results in reverse order on a challenge with
  `compare_mode: "set"`, which the prompt explicitly says to compare order-insensitively.

`gpt-oss-120b` got both right. The replacement grades *better* than what is running today.

### Qwen is not a drop-in

Called the way `review-code` calls models now, Qwen emits a `<think>` block before its JSON.
`safeParseJSON`'s fallback regex spans from the first `{` to the last `}` — across the reasoning
text — and fails. That is 3/3 submissions ungradeable; Code Practice would break entirely.
Adding `response_format: {type: "json_object"}` fixes correctness (3/3) but costs 6.2s and
~3,100 output tokens per grade, which is the wrong shape for interactive grading.

## Prose quality (the three features on the dead 8B)

There is no old output to diff against; the question is only which replacement to use.

**Do not use `llama-3.1-8b-instant` for the career assistant.** It is Groq's official successor to
`llama3-8b-8192` and it is fast (696 ms), but on a salary question it fabricated a pay ladder that
was not in the prompt and claimed the data engineer median was "not directly provided" when it was
supplied directly above. `assistant-ai` carries an explicit guard against undated, unsourced salary
figures; this model walks straight through it. `gpt-oss-120b` used the supplied BLS figures and cited them.

**`gpt-oss-120b` truncates at the current ceiling.** On the same question it hit
`finish_reason: "length"` against `assistant-ai`'s existing `max_tokens: 1024`. Migrating that
function requires raising the ceiling or answers end mid-sentence.

STAR evaluation — all three satisfy the "overall = average of the four components" rule:

| Model | Arithmetic | strengths/improvements/suggestions | Latency | Output |
|---|---|---|---|---|
| `openai/gpt-oss-120b` | correct | 5 / 5 / 3 | 2,471 ms | 1,092 tok |
| `llama-3.3-70b-versatile` | correct | 5 / 5 / 3 | 2,915 ms | 728 tok |
| `llama-3.1-8b-instant` | correct | 3 / 3 / 3 | 815 ms | 556 tok |

`gpt-oss-120b` was the only one to mark down the metric-free Result section (6 vs 7) and the only
one to propose a concrete rewrite containing numbers.

## Unrelated findings

- **Four Edge Functions are deployed with no source in this repo**: `resume-services`,
  `generate-course-content`, `analyze-job-description`, `admin-storage-config`. They cannot be
  reviewed or redeployed from main.
- `analyze-job-description` (deployed-only) calls Together AI `meta-llama/Llama-3.1-70B-Instruct`
  and OpenAI `gpt-4`.
- `ResumeChat.tsx` sends `meta-llama/Llama-3-8b-chat-hf` — a Together AI ID — to the Lovable
  gateway, which everything else addresses as `google/gemini-2.5-flash`.

## Harness

`scripts/model-migration/` holds the comparison harness. It runs as Supabase Edge Functions so the
Groq key is read from the existing `GROQ` secret and never leaves the project.

```bash
node scripts/model-migration/run-compare.mjs '{"probeOnly":true,"models":["llama-3.3-70b-versatile"]}'
node scripts/model-migration/judge-suite.mjs   # known-verdict grading suite
node scripts/model-migration/star-suite.mjs    # STAR evaluation
node scripts/model-migration/assistant-suite.mjs
```

Three temporary functions are deployed to the project (`model-compare`, `model-compare-judge`,
`model-compare-prompt`), each admin-gated. **Delete them when the migration is done.**

## Recommendation (pending approval)

`openai/gpt-oss-120b` for all five call sites — it is the only candidate that both grades
correctly and refuses to invent salary data. Migration work, once outputs are approved:

1. `review-code` — model constant only; `max_tokens: 2500` is sufficient (observed ~1,020).
2. `evaluate-star-response`, `generate-study-guide` — model constant; these are already broken,
   so this is a fix, not a regression risk.
3. `assistant-ai` — model constant **plus** raise `max_tokens` above 1024.
4. `resume-analyzer` — rename `compound-beta-mini` → `groq/compound-mini`.
5. Decide what to do about the four orphan deployed functions.
