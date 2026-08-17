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

## Status

Phases 1 and 2 are **deployed and verified live**, signed in against the real project:

| Function | Version | Verified behaviour |
|---|---|---|
| `review-code` | v20 | correct solution grades correct 4/4; missing-rounding solution grades incorrect 3/4 |
| `generate-study-guide` | v153 | 2 assessment areas populated with reasoning, 4 behavioural questions merged into 14 |
| `evaluate-star-response` | v167 | S7/T8/A9/R6 overall 8, arithmetic correct, 4/4/3 feedback, all 5 analysis keys |
| `assistant-ai` | v616 | 8,126 chars in 5.4s, not truncated, quotes the injected BLS figures with reference period |

Phase 3's ResumeChat half is deployed; the `resume-analyzer` change deploys on merge (see Phase 3).
Phases 4 and 5 are done except for three function deletions that need the Supabase dashboard.

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

- **`review-code:16`** — model → `openai/gpt-oss-120b`, `max_tokens` 2500 → 4000 (peak measured 1,419;
  a truncated response here is an unparseable verdict), plus a bounded retry on 429.
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
- **ANWAN fallback — left in place, still open.** (`utils.ts:208`,
  `Meta-Llama-3-8B-Instruct` on awanllm.com.) Removing it is not needed to repair anything, and it
  cannot be exercised from here: its key is a secret this environment does not hold, so there is no
  way to establish whether the endpoint works before deleting it. Deliberately out of scope rather
  than done quietly — the recommendation stands, but it should be a decision made with knowledge of
  whether `ANWAN` is even configured, which the Supabase secrets page will answer in a glance.

**Status: code change done and validated. Deploy it by merging to main.**

The new configuration was exercised against the live API with the exact production payload — the
`analyze_resume` tool call returned with `elevator_pitch`, three `themes` and `explanation` all
populated, 463 completion tokens in 2.4s, and the production parser accepted it.

### Edge Functions deploy automatically on push to main

Worth knowing before anyone hand-deploys anything again. Every Edge Function in this project shares
the identical `updated_at` of 2026-08-10 14:25:05 UTC, and commit `1023e3a` landed on main at
14:24:49 — sixteen seconds earlier. One timestamp across ~30 functions is a pipeline redeploying all
of them on push, not someone running the CLI thirty times. This is a Lovable project, which syncs
from GitHub and redeploys on merge.

That also explains the byte-for-byte result: `review-code`'s deployed source was verified identical
to the repo (sha256 `e05cf853…`), which is what an automated deploy from this repo produces.

So `resume-analyzer` needs no manual deployment. Merging this branch redeploys it byte-exact from
source — no transcription, no drift, and the same route every other function already takes. Confirm
after merging by re-checking the function's `updated_at`; it should move to the merge time.

`deploy-functions.sh` stays for the case where a function must be pushed without a merge, but it is
the exception, not the route.

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
repo already serves.

**Status.** `admin-storage-config`'s source is now in the repo at
`supabase/functions/admin-storage-config/index.ts`, transcribed verbatim from what is deployed, so
the auto-deploy pipeline manages it from here.

**The three deletions are not done, and cannot be done from here.** There is no delete-function tool
in this project's Supabase tooling — removing a function slug needs the dashboard or a Management API
token, neither of which is available in the session environment. Delete these three in the dashboard:

    resume-services
    generate-course-content
    analyze-job-description

The pre-delete confirmation the plan asked for came back clean: none of the three recorded a single
invocation across the log window. That window is 24 hours, so it is evidence rather than proof — a
caller that runs weekly would not show up in it.

## Phase 5 — cleanup and a guard

1. **The four temporary harness functions are retired** — `model-compare`, `model-compare-judge`,
   `model-compare-prompt`, `gateway-probe`. Same constraint as above: the slugs cannot be deleted
   from here, so each was redeployed as an inert stub that returns `410 Gone` and does nothing. All
   four verified returning 410. That removes the live surface — they no longer hold a Groq-calling,
   database-reading body — but the slugs remain and should be deleted in the dashboard. The runner
   scripts stay in `scripts/model-migration/` for the next migration.
2. **`npm run check:models` is added and wired into `pr-checks.yml`**, alongside
   `check:migrations`. It works from an allowlist rather than a blocklist: any model id the source
   assigns that is not explicitly permitted fails the build, and ids known to be decommissioned fail
   with the shutdown date attached.

   It was tested by reintroducing both of this audit's real failures and confirming each one fails
   the check — which is how a genuine gap surfaced. The first draft matched `/\b(?:model|MODEL)\s*[:=]/`
   and silently missed `CHAT_MODEL`, because the character before `MODEL` is an underscore and `\b`
   needs a non-word character there. `CHAT_MODEL` is the exact constant that sent a Together AI id to
   the Lovable gateway, so the check would have missed the bug it was written for. A green run on a
   clean tree proved nothing; running it against the known failures is what found it.

## Rollback

Each change is a single string constant plus, in two cases, a token ceiling. Revert the constant and
redeploy the function; no data migration is involved and nothing is written in a new shape. The one
change that alters stored data shape is none of them — `assistant_messages.model` now records the
model actually configured rather than a stale hardcoded default, which only affects rows written from
this point on.

## Sequencing

Phase 2 is the only deadline-bound item. Phase 1 is the largest user-visible win and carries the least
risk, so it can ship first or alongside. Phases 3–5 are independent of the decommission entirely.

## Found while deploying

`review-code` needed a rate-limit retry that the plan did not anticipate. `gpt-oss-120b` spends
roughly 4x the output tokens the 70b did, while `MAX_SUBMISSIONS_PER_MINUTE` still allows 10 grades
a minute against a free-tier budget of 8K tokens per minute. A second submission inside a minute
reproduced a Groq 429 as a hard 500 for the student. `callGroq` now retries twice, honouring
`retry-after` and capping the wait at 8s so it stays inside the request the browser is waiting on.

The same arithmetic applies to any other function that starts seeing real traffic on this model.
Upgrading to the Developer plan removes the constraint; until then the retry is what keeps a burst
of submissions from surfacing as errors.

## E2E results and attribution

Full suite via `npm run e2e:relay` on this branch: **712 passed, 3 failed, 1 flaky, 22 skipped**
(17.1m). Each failure was attributed before merging rather than assumed:

| Spec | On this branch | On `origin/main` | Verdict |
|---|---|---|---|
| `journeys/career-quiz-results.spec.ts:22` | fail | **fail** | pre-existing |
| `admin/admin-instructor-roster.spec.ts:38` | fail | **fail** | pre-existing |
| `career/career-pathway.spec.ts:134` | fail in full suite | pass | flake — passes in isolation on this branch (6.4s) |
| `journeys/certificate-generation.spec.ts:21` | flaky (passed on retry) | — | flake |

`career-quiz-results` and `admin-instructor-roster` fail on main by themselves, so main is not
currently green and these are worth someone's attention independently of this migration. Neither
touches anything this branch changed: the specs reference `courses`, `enrollments`, `profiles` and
quiz attempts, none of which appear in this diff.

One process note. The first run was invoked as `npm run e2e:relay | tail -60`, which reports
**tail's** exit status, not Playwright's — so it looked like a clean exit 0 while three tests were
failing, and the truncation also discarded the failure detail for the spec that most needed it. Pipe
Playwright to a file and read the file; do not pipe it to `tail`.
