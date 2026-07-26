# Real Code Evaluation for Code Practice — Architecture

Status: Phases 0–1 implemented; Phase 2 scaffolded (see "Implementation status" below)
Owner: Interview Prep / Code Practice
Related page: `src/pages/interview-prep/CodePractice.tsx` (Soft Studio, Problem Book)

## 1. Where the challenge data lives today

There are currently **two generations** of this feature in the codebase, and
the answer to "where is the data stored?" is different for each:

### The routed page (what users see) — hardcoded, no test cases
`src/pages/interview-prep/CodePractice.tsx` renders `/interview-prep/code-practice`.
Its challenges live in a **hardcoded `challengesByRole` constant inside the
component file** — seven entries keyed by role (`data_analyst`, `data_scientist`,
`data_engineer`, `cloud_engineer`, `business_intelligence`, `product_analyst`,
`all`). Each entry has `title`, `difficulty`, `description`, `detail`,
`example` (prose), `constraints[]`, `hints[]`.

- **There are no test cases.** The `example` field is display prose, not
  machine-checkable data.
- **Nothing is evaluated.** `handleSubmit` is a 1.5s `setTimeout` that always
  returns `correct: true`, `42ms`, `8.2MB`, `3/3` regardless of the code.
- **Nothing is persisted.** Submissions are not written anywhere.

### The abandoned real implementation — DB-backed, with test cases
`src/pages/CodePractice.tsx` (lazy-imported in `App.tsx` but **not routed to**
— dead code) is an earlier, more complete build of this exact feature:

- Loads challenges from the **`code_challenges` table**, filtered by the
  topics in the user's latest study guide (`study_guides.technical_checklist`),
  via `.contains('topic_tags', topics)`.
- Calls a **`execute-code` Edge Function** and renders per-test results
  (input / expected / actual / passed / executionTime).
- On all-tests-passed, calls a **`review-code` Edge Function** and renders a
  full AI review (correctness/efficiency/style/overall scores, complexity
  analysis, strengths, improvements, alternative approaches).

**The database schema for this already exists** (see
`src/integrations/supabase/types.ts`):

| Table | Columns | Notes |
|---|---|---|
| `code_challenges` | `id`, `title`, `prompt`, `test_cases Json`, `topic_tags text[]`, `difficulty`, `created_at` | RLS: only admins can insert. Test-case shape used by the legacy UI: `{ input: string, setup?: string, expectedOutput: string }[]` |
| `code_attempts` | `id`, `user_id`, `challenge_id → code_challenges`, `code`, `language`, `passed_tests bool`, `ai_review Json`, `duration`, `created_at` | Per-submission history, ready for streaks/progress features |

**What's missing** (why the legacy page was presumably shelved):

1. The `execute-code` and `review-code` Edge Functions **do not exist** in
   `supabase/functions/` — the legacy page calls functions that were never built.
2. **No seed data**: no migration inserts any `code_challenges` rows, so the
   table is empty unless rows were added manually in production.

So: the intended architecture was already designed — challenges with test
cases in the DB, an execution function, an AI-review function, and an
attempts table. The plan below completes that design rather than inventing
a parallel one.

## 2. Target architecture

```
CodePractice page (Soft Studio)
   │  submit { challengeId, code, language }
   ▼
execute-code (Edge Function)          ← Phase 2 (real execution)
   │  loads challenge + test cases server-side (service role)
   │  builds harness → runs code in sandbox (Piston / Judge0)
   │  compares outputs per test case
   │  → { results[], allTestsPassed, runtimeMs, memoryKb, attemptId }
   │  inserts code_attempts row
   ▼
review-code (Edge Function)           ← Phase 1 (AI judge / review)
   │  loads attempt + challenge
   │  LLM (Groq / Together AI — same pattern as evaluate-star-response)
   │  → { scores, analysis, strengths, improvements, alternative_approaches }
   │  updates code_attempts.ai_review
   ▼
Result card: n/m test tiles + runtime + memory + AI review + suggestions
```

The Soft Studio Result card already has the right slots (stat tiles, review
box, suggestions box), so the UI cost of going real is small.

## 3. Path 1 — AI judge + review (ship first)

One new Edge Function, `review-code` (name kept from the legacy design), with
two modes:

- **Judge mode** (until real execution exists): the function loads the
  challenge **and its test cases server-side** and asks the model to trace
  the submitted code against each test case, returning a per-test
  pass/fail *prediction*, an overall verdict, and the review payload.
- **Review mode** (after Phase 2): skips judging (execution already
  produced ground truth) and only produces the qualitative review.

Implementation notes:

- Copy the proven mechanics of `evaluate-star-response/index.ts`: Groq
  `llama3-8b-8192` (or the `together-ai` function's models), temperature 0.3,
  "return ONLY JSON" prompt, `safeParseJSON` from `_shared/utils.ts`,
  service-role Supabase client, CORS headers.
- Persist every submission to `code_attempts`
  (`passed_tests`, `ai_review`, `language`, `code`, `duration`).
- Response shape matches what the Result card renders, plus
  `evaluationMode: 'ai-judged' | 'executed'` so the UI can label results
  honestly ("AI-judged" chip vs real runtime/memory tiles).
- Secrets: `GROQ` already exists (used by STAR evaluation). No new secrets.

**Honest limits of Path 1**: the model *predicts* test outcomes rather than
running code, so it can be wrong on tricky edge cases and cannot measure
runtime/memory. While in judge mode the UI should show "n/m checks
(AI-judged)" and hide the runtime/memory tiles.

## 4. Path 2 — real execution

A second Edge Function, `execute-code`, that actually runs submissions.

### Executor options

| Option | Cost | Key | Python + pandas? | Notes |
|---|---|---|---|---|
| **Piston public API** (emkc.org) | Free | None | ❌ stdlib only | ~5 req/s shared rate limit; great for JS + stdlib-Python challenges |
| **Judge0 CE** (RapidAPI) | Free tier ~50 req/day, paid beyond | `RAPIDAPI_KEY` | ❌ (CE) | Mature, returns time + memory per run |
| **Judge0 Extra CE** | Same | Same | ✅ "Python for ML" runtime (pandas, numpy, scikit-learn) | Needed for the Data Analyst / Data Scientist pandas challenges |
| **Self-hosted Piston** (Docker) | Infra cost | None | ✅ custom packages | Most control; most ops burden |

**Recommendation**: start with **Piston public** for JavaScript and
stdlib-Python challenges (zero cost, zero keys), and route pandas-tagged
challenges to **Judge0 Extra CE** (one `RAPIDAPI_KEY` secret) or keep them
AI-judged until usage justifies self-hosting. The function should pick the
executor per challenge via a `runtime` field on the challenge row.

### Harness design

User code alone isn't runnable — each challenge needs a driver. Store with
each challenge (inside the `test_cases` Json envelope, no migration needed):

```jsonc
{
  "function_name": "solution",
  "runtime": "python-stdlib" | "python-ml" | "javascript",
  "cases": [
    { "input": "[2,7,11,15], 9", "expected": "[0,1]", "hidden": false },
    { "input": "[3,2,4], 6",     "expected": "[1,2]", "hidden": true }
  ]
}
```

`execute-code` wraps the submission in a per-language harness template that
calls `function_name(...case.input)` for each case, printing
`JSON.stringify`/`json.dumps` of the result one line per case. Comparison is
JSON-deep-equality after parsing (falling back to normalized string compare),
which sidesteps whitespace/float-formatting flakiness. One sandbox run
executes all cases (cheaper than one run per case).

### Security & abuse controls

- Test expectations (especially `hidden` cases) are loaded **server-side
  only**; the client never receives expected outputs for hidden cases.
- JWT required; the function derives `user_id` from the token, never the body.
- Per-user rate limit (e.g. 10 submissions/min via a lightweight
  `code_attempts` count query) to protect executor quotas.
- Executor sandboxes untrusted code by design (that's their job); the Edge
  Function never `eval`s user code itself.

## 5. Data migration & seeding

1. **Seed migration**: convert the 7 hardcoded `challengesByRole` entries into
   `code_challenges` rows — prose fields into `prompt` (markdown), roles into
   `topic_tags` (e.g. `['data_analyst', 'pandas']`), and **write real test
   cases** for each (3–5 per challenge, mix of visible + hidden). This is the
   main authoring effort of the whole plan.
2. Keep the admin-insert RLS policy; seeding runs as a migration (superuser).
3. Frontend keeps the hardcoded set as a **fallback** when the table returns
   no rows for a role, so the page never regresses to an empty state.

## 6. Phasing

| Phase | Deliverable | Effort | User-visible result |
|---|---|---|---|
| 0 | Seed migration: challenges + authored test cases in DB; page reads from DB with hardcoded fallback | S–M | Same page, real data source |
| 1 | `review-code` (judge mode) + `code_attempts` persistence + honest "AI-judged" labeling | M | Submissions actually evaluated; wrong code gets called wrong |
| 2 | `execute-code` via Piston (JS + stdlib Python); pandas challenges stay AI-judged | M | Real n/m tests, runtime, memory for most challenges |
| 3 | Judge0 Extra CE (or self-hosted Piston) for pandas; review-code switches to review-only mode after execution | S–M | Everything real; AI provides the qualitative review on top |

Each phase is independently shippable and none blocks the visual redesign
work already merged.

## 7. Implementation status

All three decisions were approved (Phase 0+1 now; RapidAPI key accepted for
Phase 2; legacy page cleanup pending a final port check).

**Implemented:**

- **Phase 0** — `supabase/migrations/20260727000000_code_challenges_evaluation.sql`:
  structured columns (`description`, `detail`, `example`, `constraints`,
  `hints`, `language`, `starter_code`, `function_name`, `runtime`,
  `compare_mode`), an authenticated-read RLS policy, and 7 seeded challenges
  with authored, machine-checkable test cases (visible + hidden).
  `CodePractice.tsx` loads the challenge for the selected role from the
  database and keeps the hardcoded set as a demo fallback (logged-out /
  empty table). The Result card labels every evaluation honestly:
  Demo / AI-judged / Executed.
- **Phase 1** — `supabase/functions/review-code/`: AI judge + review
  (Groq `llama-3.3-70b-versatile`, temperature 0.1). Loads test cases
  server-side (hidden cases never reach the client), returns per-case
  verdicts + review + 3 suggestions, persists every attempt to
  `code_attempts`, rate-limits to 10 submissions/user/minute. The page
  calls it whenever the user is signed in and a DB challenge is loaded.
- **Phase 2 (scaffolded)** — `supabase/functions/execute-code/`: builds a
  per-language harness (one sandbox run for all cases, JSON-per-line
  output, `compare_mode` aware), executes on Piston (javascript /
  python-stdlib; free, no key) or Judge0 Extra CE "Python for ML"
  (pandas; needs `RAPIDAPI_KEY`), deep-JSON-compares outputs, persists
  attempts. Passing its `results` into `review-code` as
  `executionResults` flips that function to review-only mode — the
  combined Phase 3 flow. Not yet wired into the page; do that after the
  function is deployed and smoke-tested against real sandboxes.

**Deployment** (functions can't be integration-tested in this sandbox —
verify after deploying):

```bash
supabase db push                        # applies the Phase 0 migration
supabase functions deploy review-code
supabase functions deploy execute-code
# GROQ is already set if STAR evaluation works. For pandas execution:
supabase secrets set RAPIDAPI_KEY=<your RapidAPI key for judge0-extra-ce>
```

**Remaining:**

1. Deploy + smoke-test both functions; then wire the page's submit to
   `execute-code` → `review-code` (Phase 3) for `runtime`/`memory` tiles
   with real numbers.
2. Delete the legacy `src/pages/CodePractice.tsx` and its unused
   lazy-import in `App.tsx` (its DB-loading and per-test-results ideas are
   now ported).
3. Grow the challenge bank: the admin-insert RLS policy is in place, so an
   admin authoring UI or further seed migrations both work.
