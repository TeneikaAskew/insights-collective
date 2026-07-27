# Verification: how to know it works, and how I fooled myself

## Green is not evidence

The single most expensive habit in this work was treating a passing run as proof.

Three times a suite went green while the app had **no data at all**:

1. Sessions in `.playwright-sessions/*.json` expire in about an hour. A stale one
   silently signs the user out, every page renders its logged-out state, and
   assertions on generic headings pass.
2. `--host-resolver-rules=MAP * 127.0.0.1:1` applies to **IP literals as well as
   hostnames**, so the relay at `http://127.0.0.1:54399` was mapped to a closed
   port. Pages rendered; every Supabase call died. "6 passed."
3. The app's own CSP (`connect-src 'self' wss: https:`) blocked the plain-HTTP
   relay. The request never left the browser, so it surfaced as a bare
   `TypeError: Failed to fetch` with no mention of CSP.

In each case the test output said pass. The way to catch it is a **positive
assertion that data arrived**, not the absence of failure:

```
relay responses: 45 ok, 0 failed
page: "Welcome back, E2E Member! … Enrolled Courses 1"
```

Before trusting a green run after any infrastructure change, ask: *how many
successful data requests did the page actually make?* Zero is the answer that
matters.

## Prove the check can fail

A gate nobody has seen fail is a gate nobody knows works. Every check added here
was verified in both directions:

| check | positive | negative |
|---|---|---|
| CI query gate | 305 shapes, 0 reachable failures | reintroduced `profiles.full_name` → exit 1, named the route |
| types drift | clean against live catalogue | planted a stale column → exit 1 |
| invariants | 4/4 hold | ran the predicate with one profile masked → returns 1 |
| wiring guard | passes | removed `global.fetch` from client.ts → failed with the intended message |
| interceptor | quiet on healthy writes | member deleting another user's certificate → `empty-write` recorded |

If you cannot make a check fail on demand, you have not tested the check.

## Measure before claiming a cost is acceptable

"One count per write is cheap" is a guess. The plan required a number before
merging, and the number was worth having: 150 interleaved samples per arm, median
+0.3ms on a 68ms round trip, trimmed mean +0.8ms.

Use a **trimmed mean** for anything crossing a network. Shared-tenancy Postgres
over the public internet throws occasional 300ms outliers that swamp the plain
mean; the first run showed "+11.3ms mean" alongside "-0.6ms median", which is
noise wearing a decimal point.

Interleave the two arms rather than running one after the other, so drift in
conditions hits both equally.

## Harness bugs look exactly like product bugs

The audit tooling produced several confident, wrong answers. Each one cost real
time and would have caused a wrong fix:

- **Unbounded lookahead** for `.select()` attributed the *next* query's columns
  to the current one, inventing `notifications.due_date` and
  `blog_post_tags.first_name`. Fixed by bounding at the statement terminator.
- **RPC existence by calling with no args**: PostgREST answers PGRST202 "without
  parameters" for anything that merely *requires* arguments → 22 false MISSING.
  Fixed by reading `pg_proc`.
- **Whitespace**: postgrest-js strips whitespace outside quotes before sending.
  The raw multi-line template returned 200 while the string actually sent
  returned 42703 — so a broken page was reported healthy.
- **Comments**: the inventory scanned commented-out code and reported a
  `course_settings` table that never existed as a broken shape in live code.
- **Stale sessions** in the route sweep produced 401s that looked exactly like a
  permissions defect. Signing in fresh returned 200.

When a tool reports something surprising, **suspect the tool first.** A
diagnostic that produces false defects is worse than no diagnostic, because it
spends attention on nothing.

## Verify the thing you are actually shipping

`verify-fixtures.mjs` originally checked that quiz question rows existed. They
did — and the quiz was still unanswerable, because
`get_quiz_questions_for_taking` reads an `answers` column the seed never set and
falls back to `options` only when `answers` is absent.

Checking "the row exists" answered a question nobody was asking. Calling the RPC
the page calls answered the real one.

Ask the same question the user's code asks, through the same interface.

## Distinguish environment from defect, with evidence

36 spec failures were, correctly, the sandbox — but "it's the environment" is the
easiest wrong answer in the world. The evidence that made it credible was that
`/dashboard`, untouched by any change, failed identically, and that `curl`
reached the same host in 0.48s while Chromium was reset.

State the limitation plainly and keep it out of the success claim. Then, if
possible, fix the environment rather than living with it — the relay took an hour
and turned "cannot run" into a running suite.
