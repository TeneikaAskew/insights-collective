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
| Resume analyzer (Groq fallback) | `resume-analyzer/utils.ts:249` | `compound-beta-mini` | **cannot serve its caller** | model resolves, but rejects tool calls — see below |
| resume-services · sentence detect | deployed only, no repo source | `llama3-8b-8192` | **dead since 2025-08-30** | orphan function |
| resume-services · bullet improve | deployed only, no repo source | `llama3-8b-8192` | **dead since 2025-08-30** | orphan function |

Ten further AI call sites run on `google/gemini-2.5-flash` via the Lovable gateway and are unaffected.

## The resume stack

Resume is the largest AI surface on the site and none of it runs on the decommissioned 70B, so the
vendor email would not have surfaced any of it. Its primary path (Gemini via Lovable) is healthy.
Two things around that path are not.

**Resume Chat's send path is broken.** `ResumeChat.tsx:492` hardcodes `meta-llama/Llama-3-8b-chat-hf`
— a *Together AI* model ID — and `together-ai` forwards it verbatim to the Lovable gateway, which
returns `400 invalid model`. There is no fallback: the 400 throws, the function 500s, the chat errors.
Unrelated to Groq; it has never been pointed at a model the gateway serves.

**The Groq fallback cannot serve the enhancer.** `AI_ENHANCER` (elevator pitch, three improvement
themes, grade explanation) uses tool calling. `compound-beta-mini` returns
`400 · "tool calling" is not supported with this model`. So when Gemini is unavailable the Groq
fallback fails structurally at any setting, drops to the third-party ANWAN endpoint, and if that also
fails the enhancer returns empty content **without raising an error**. Of 33 resumes on file, 27 have a
pitch but only 14 have themes. Both fallbacks are also capped at `max_tokens: 500` against the
primary's 2,000.

On the exact enhancer tool-call payload, `gpt-oss-120b` returned a well-formed `analyze_resume` call
in 1,160 ms with all three fields populated; the current 70B also handles it (1,090 ms). Only
`compound-beta-mini` cannot. Replacing it restores a fallback that has never worked.

`assistant_messages.model` is not evidence of which model served a request — `ResumeChat` writes a
hardcoded default into that column regardless, and `assistant-ai` never writes it at all.

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

**Four Edge Functions are deployed with no source in this repo**: `resume-services`,
`generate-course-content`, `analyze-job-description`, `admin-storage-config`. They are live and
reachable with any signed-in user's JWT, and cannot be reviewed or redeployed from main.
`analyze-job-description` calls Together AI `meta-llama/Llama-3.1-70B-Instruct` and OpenAI `gpt-4`.

They are **superseded predecessors, not dead features**. Every AI feature their names suggest exists
and is wired up — to a newer function in the repo. The orphans were last deployed April–May 2025;
their replacements landed July–August 2026.

| Feature in the UI | What actually serves it | Superseded orphan |
|---|---|---|
| Course → generate content with AI | `generate-lesson-content`, `generate-course-outline`, `generate-section-summary` | `generate-course-content` (2025-04-16) |
| Analyze a job description | `scrape-job-description`, `generate-study-guide`, `analyze-job-match` | `analyze-job-description` (2025-05-18) |
| Resume sentence detect / bullet improve | `resume-analyzer` (same logic, in repo) | `resume-services` (2025-04-11) |
| *no UI found* | — | `admin-storage-config` (2026-08-10) |

Note `generate-study-guide` — the live half of "analyze a job description" — is the function whose
assessment-area selection sits on the dead 8B. That feature runs, quietly missing its behavioural
questions.

`admin-storage-config` is the odd one: deployed 2026-08-10, superseded by nothing, not in the repo,
not referenced in `src/`. That reads as an edit made outside git, not an old leftover.

**How far the "not used" claim goes.** Those four slugs appear zero times anywhere in `src/` — not in
an `invoke`, not in a variable, not in a string — and all 39 `functions.invoke` call sites in the
frontend were enumerated, none targeting them. What that does not prove: this is a Lovable app, so a
published build may differ from this repo, and any other client or signed-in user can still reach the
endpoints directly. "Not called by this frontend" is accurate; "never called" is not establishable
from source.

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
