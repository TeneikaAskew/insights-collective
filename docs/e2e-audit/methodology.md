# How this audit was produced

Three independent evidence sources, because each is wrong in a different way and
only the overlap is trustworthy. Every tool lives in `scripts/audit/` and is
re-runnable.

## 1. Static inventory — `scripts/audit/query-inventory.mjs`

Scans `src/` for every `.from()`, `.rpc()`, `functions.invoke()` and
`storage.from()`. Emits `.e2e-audit/query-inventory.json`.

Current surface: **702 table call sites over 97 tables, 47 RPC sites over 24
functions, 46 edge-function sites, 20 storage sites.**

Two parsing details had to be right, and both were found by disagreeing with a
hand-checked result:

- **The chained `.select()` is bounded to its own statement.** An unbounded
  lookahead attributed the *next* query's select to this one and invented
  columns nothing asks for — `notifications.due_date`,
  `blog_post_tags.first_name`, `blog_post_views.view_count`.
- **`.rpc()` params are read at the top level only.** A flat `key:` regex also
  matched keys nested inside a `p_metadata` payload, reporting
  `log_security_event` as called with the wrong signature when it is called
  correctly.

## 2. Live replay — `scripts/audit/replay-queries.mjs`

Issues each distinct query shape against the real project as anon, member,
instructor and admin. Emits `.e2e-audit/query-results.json`.

**This does not consult `src/integrations/supabase/types.ts`, and neither should
you.** That file is stale relative to the applied migrations. Four column
mismatches flagged against it resolved as two real defects, one already fixed by
a migration, and one entirely imaginary. The database is the only authority.

Two fidelity requirements:

- **The select list is whitespace-stripped exactly as postgrest-js does it.**
  Not cosmetic: sending the raw multi-line template literal from
  `CourseProgressOverview` returns **200**, while the whitespace-stripped form
  the client actually sends returns **`42703 column modules_1.order_index does
  not exist`**. Replaying the unstripped string reports a broken page as healthy.
- **RPC existence comes from `pg_proc`, not from calling the function.** Calling
  with `{}` returns `PGRST202 … without parameters` for anything that merely
  *requires* arguments — 22 false "missing function" verdicts.

Writes are never executed; they are reported as a column/grant/policy check.

## 3. Route reachability — `scripts/audit/route-reachability.mjs`

Walks `App.tsx` and the transitive import closure of each routed component, so a
broken query in dead code is not ranked beside one on a page users load daily.
Emits `.e2e-audit/route-reachability.json`.

Validated against hand-checked cases: the forum pages, the legacy
`pages/CodePractice.tsx` and `pages/MockInterviews.tsx`, `PeerReviewSystem` and
`blogServiceV2` all resolve as unreachable; `CourseQuizResults` and
`CourseProgressOverview` resolve to their real routes.

## 4. Browser sweep — `scripts/audit/route-sweep.mjs`

Loads every route as every role and records every non-2xx Supabase response plus
the visible page state. Emits `.e2e-audit/route-sweep.json`.

This is the arbiter. Replay proves a shape is *invalid*; only the browser proves
the page *runs* it. Several invalid shapes sit behind role or tab conditions and
never fire — `/courses/:id/quiz-results` renders correctly for every role despite
containing a `42703` select — so findings are graded:

| grade | meaning |
|---|---|
| **CONFIRMED** | the sweep observed the request fail on this route |
| **LATENT** | invalid shape in reachable code, not fired on the default path |
| **DEAD** | module no route can reach |

**The sweep signs in fresh rather than reusing `.playwright-sessions/*.json`.**
Those tokens expire in an hour; a run against stale ones reported 401s on
`code_challenges` and `enrollments` for the *member* role and looked exactly like
a permissions defect. Signing in again returned 200 for both. A diagnostic that
manufactures false defects is worse than no diagnostic.

## 5. Suppressed-error recorder — `E2E_AUDIT_CONSOLE=1`

`e2e/fixtures/console-errors.fixture.ts` gained a recorder that logs every
console error **and every non-2xx response**, suppressed or not, to
`.e2e-audit/console-audit.jsonl`. Failed fetches the app handles itself never
reach the console listeners, so those were invisible even in principle.

Why record instead of just deleting the two blanket ignore rules: the rules were
compensating for the nine placeholder fixture IDs in
`e2e/helpers/route-helpers.ts`. Removing them first would bury the real defects
under known-bad-fixture noise. Record now, tighten once the fixtures are real.
Audit mode never changes pass/fail.

## 6. Spec analysis — `scripts/audit/spec-analysis.mjs`

Counts, per spec, the patterns that let a test pass while the feature under it is
broken, and grades assertion strength. Emits `.e2e-audit/spec-analysis.json`.

The grade is a heuristic and is presented as one. The **counts** are exact, and
they are the part worth acting on.

## Reproducing

```bash
node scripts/audit/query-inventory.mjs
node scripts/audit/route-reachability.mjs
SUPABASE_ACCESS_TOKEN=… node scripts/audit/replay-queries.mjs   # needs .env role creds
node scripts/audit/route-sweep.mjs                              # needs the app on :8080
node scripts/audit/spec-analysis.mjs
E2E_AUDIT_CONSOLE=1 npx playwright test                         # fills console-audit.jsonl
```
