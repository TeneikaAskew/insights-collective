# Groq model transition plan

Companion to `groq-model-decommission-2026-08.md`, which holds the audit and the
measurements this plan rests on. Every model choice below is `openai/gpt-oss-120b`,
on the evidence recorded there: it grades 6/6 against the outgoing 70B's 4/6, it is the
only candidate that used supplied wage data instead of inventing salary figures, and it
is the only Groq option that both parses cleanly under the production JSON parser and
supports the tool calling the resume enhancer needs.

## Every Groq call site

Eight, across five functions. Three are in functions with no source in this repo.

| # | Call site | Model now | Target | Verified state today |
|---|---|---|---|---|
| 1 | `review-code/index.ts:16` | `llama-3.3-70b-versatile` | `openai/gpt-oss-120b` | working; dies at the cutoff |
| 2 | `assistant-ai/index.ts:440` | `llama3-8b-8192` | `openai/gpt-oss-120b` | hard 500 |
| 3 | `evaluate-star-response/index.ts:280` | `llama3-8b-8192` | `openai/gpt-oss-120b` | hard 500 |
| 4 | `generate-study-guide/index.ts:127` | `llama3-8b-8192` | `openai/gpt-oss-120b` | silent degradation |
| 5 | `resume-analyzer/utils.ts:249` | `compound-beta-mini` | `openai/gpt-oss-120b` | 400 on tool calling |
| 6 | `resume-services` · detect-sentences | `llama3-8b-8192` | delete function | hard 500 (verified) |
| 7 | `resume-services` · improve-bullet | `llama3-8b-8192` | delete function | silent 200 (verified) |
| 8 | `generate-course-content` | `llama3-8b-8192` | delete function | hard 500 (verified) |

## Phase 0 — before any code change

1. **Rotate the Groq API key.** It was pasted into a chat transcript. Rotate at
   console.groq.com/keys and update the `GROQ` secret. Nothing below depends on the old value.
2. **Diff `resume-analyzer`'s deployed source against the repo.** `review-code` was verified
   byte-identical; `resume-analyzer` (2,666 lines / 9 files) was not, and it is the one function
   here whose deployment could differ from what we are about to edit.

## Phase 1 — restore what is already broken

No regression risk: these three return 500s or empty content today, so any working model is an
improvement. Do these first, independently of the decommission deadline.

- **`assistant-ai:440`** — model → `openai/gpt-oss-120b`, **and raise `max_tokens` from 1024 to
  4096**. Measured: gpt-oss-120b hit `finish_reason: "length"` at 1024 on a normal career question
  and truncated mid-table. Shipping the model change without the ceiling change trades a 500 for a
  cut-off answer.
- **`evaluate-star-response:280`** — model only. `max_tokens: 3000` is ample (measured 1,092).
- **`generate-study-guide:127`** — model only. `max_tokens: 2000` is ample.

Verify: `scripts/model-migration/star-suite.mjs` and `assistant-suite.mjs`, then submit one real
STAR response and generate one study guide and confirm behavioural questions come back.

## Phase 2 — beat the decommission

- **`review-code:16`** — model → `openai/gpt-oss-120b`. `max_tokens: 2500` stays (measured ~1,020).
  Also correct the comment above the constant, which still says the 8B "used elsewhere in the repo"
  is not reliable enough — that 8B has been decommissioned for a year.

Latency rises from ~865 ms to ~2,270 ms per grade. That is the cost of 6/6 over 4/6; if it proves
too slow in the UI, `reasoning_effort: "low"` is the first lever to try, not a different model.

Verify: `scripts/model-migration/judge-suite.mjs` — expect 6/6 with 0 parse failures.

## Phase 3 — the resume stack

- **ResumeChat model ID — done.** `ResumeChat.tsx` now sends `google/gemini-2.5-flash` through one
  `CHAT_MODEL` constant used for both the request and the row written about it. Validated signed-in
  end to end: HTTP 500 before, HTTP 200 with a streamed reply after.
- **`resume-analyzer/utils.ts:249`** — model → `openai/gpt-oss-120b`, **and raise the GROQ branch's
  `max_tokens` from 500 to 2000** to match the Gemini primary. This is the change that actually
  repairs the enhancer: `compound-beta-mini` rejects tool calls outright, so the fallback has never
  been able to serve the elevator pitch and themes.
- **Decide on the ANWAN fallback** (`utils.ts:208`, `Meta-Llama-3-8B-Instruct` on awanllm.com). It is
  a third-party endpoint, untested here, also capped at 500 tokens. Recommend removing it: with a
  working Groq fallback it adds a dependency without adding resilience.

Verify: `scripts/model-migration/resume-tool-suite.mjs` — expect `made_tool_call=true` with pitch,
three themes and explanation populated.

## Phase 4 — the orphan functions

All four were invoked and their behaviour recorded. They split two ways.

**Keep and adopt — `admin-storage-config`.** Not deprecated and not AI: an admin-gated utility that
re-applies the `course-documents` bucket's MIME allowlist and 25 MB cap. Invoked as admin it returned
HTTP 200 and the bucket was byte-identical afterwards — correctly idempotent. Its only problem is
that its source is not in git. **Commit the source to `supabase/functions/admin-storage-config/`.**

**Delete — the other three.** Each is superseded by a newer in-repo function and each is broken:

| Orphan | Superseded by | Verified behaviour |
|---|---|---|
| `resume-services` | `resume-analyzer` | 500 `GROQ API error: 400`; improve-bullet returns 200 with the bullet unchanged |
| `generate-course-content` | `generate-lesson-content`, `generate-course-outline`, `generate-section-summary` | 500 `model_decommissioned` |
| `analyze-job-description` | `analyze-job-match`, `generate-study-guide` | 404 on a nonexistent id — live and reachable; stale Together AI and `gpt-4` ids |

Delete rather than repair: fixing them would mean maintaining a second implementation of features the
repo already serves. Before deleting, confirm no non-repo client calls them — the source search only
proves this frontend does not.

## Phase 5 — cleanup and a guard

1. **Delete the four temporary harness functions** from the project: `model-compare`,
   `model-compare-judge`, `model-compare-prompt`, `gateway-probe`. The runner scripts stay in
   `scripts/model-migration/` for the next migration.
2. **Add `npm run check:models`** as a PR check, in the same spirit as `check:migrations`: fail the
   build when a known-decommissioned model id (`llama3-8b-8192`, `llama3-70b-8192`,
   `mixtral-8x7b-32768`, `gemma-7b-it`, `gemma2-9b-it`, `compound-beta*`) or a model id from the
   wrong provider (a Together AI id sent to the Lovable gateway) appears in the source. Every failure
   in this audit would have been caught at authoring time by that one check.

## Rollback

Each change is a single string constant plus, in two cases, a token ceiling. Revert the constant and
redeploy the function; no data migration is involved and nothing is written in a new shape. The one
change that alters stored data shape is none of them — `assistant_messages.model` now records the
model actually configured rather than a stale hardcoded default, which only affects rows written from
this point on.

## Sequencing

Phase 2 is the only deadline-bound item. Phase 1 is the largest user-visible win and carries the least
risk, so it can ship first or alongside. Phases 3–5 are independent of the decommission entirely.
