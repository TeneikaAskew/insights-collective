# Repo and stack specifics worth not rediscovering

Facts about this project's stack that cost time to establish. Each was verified
against the live system, not inferred.

## PostgREST / Supabase

- **Writes report affected rows** via `Content-Range` when you send
  `Prefer: count=exact`. Verified live: DELETE matching a row → `*/1`; matching
  nothing → `*/0`; PATCH permitted → `0-0/1`; PATCH filtered by RLS → `*/0`.
- **supabase-js appends to `Prefer`** rather than replacing it
  (`PostgrestQueryBuilder.js`), so adding `count=exact` cannot clobber
  `return=representation` or `resolution=merge-duplicates`.
- **`Prefer` is not CORS-safelisted.** Sending it to an Edge Function triggers a
  preflight, and a function whose `Access-Control-Allow-Headers` omits `prefer`
  has the request blocked outright. Scope the header to `/rest/v1/`.
- **postgrest-js strips whitespace outside double quotes** from `select()`
  before sending. Replaying a raw multi-line template tests a different string
  than the client sends — one returns 200, the other 42703.
- **PostgREST serves only the `public` schema**, and OpenAPI introspection is
  off on this project (`GET /rest/v1/` returns zero paths for anon *and* admin).
  A view in `public` with `security_invoker = true` is the way to expose a
  catalogue without granting anything new.
- `authenticated` **can** read `pg_proc`, `pg_constraint`, `pg_policy` and
  `information_schema`. It **cannot** read `auth.users` (42501) — the one place
  a `SECURITY DEFINER` function is warranted here, and it should return counts,
  never rows.
- **A policy written `TO authenticated` still needs a table-level SELECT grant.**
  Without it Postgres refuses with `42501` before RLS is consulted, which reads
  exactly like a missing policy. (`20260731000800` fixed three tables.)
- **`NOT VALID` + `VALIDATE CONSTRAINT`** takes a weaker lock: the constraint
  applies to new rows immediately and existing rows are checked separately.
- `.single()` returning zero rows is **PGRST116 / HTTP 406**, a data condition —
  not an error worth failing a test over.
- **PostgREST cannot embed `profiles` through a key that points at `auth.users`.**
  `profiles!content_discussions_user_id_fkey` resolves to `auth.users` and
  returns PGRST200; `…_user_id_profiles_fkey` works. Fourteen of the twenty-one
  broken shapes were this one mistake, fixed durably by adding real FKs from
  nine tables to `public.profiles`.

## Triggers that will silently rewrite your write

`quiz_submissions` has `pin_quiz_submission_score()`, which nulls `score` and
downgrades `workflow_state` from `complete` to `pending_review` for anyone who
is not grading staff. A seed that inserts a graded submission gets an ungraded
one back, with no error.

`is_grading_staff()` reads `request.jwt.claims`, so a trusted seed can adopt the
instructor's identity for one transaction:

```sql
PERFORM set_config('request.jwt.claims',
                   json_build_object('sub', v_instructor_id, 'role', 'authenticated')::text,
                   true);   -- true = transaction-local
```

That is not bypassing the control — it is the seed acting as the identity that
would legitimately produce a graded submission. Then **assert the score
survived**, so a seed that loses the identity fails loudly instead of leaving an
ungraded row behind a passing check.

## Quiz content has two shapes

`get_quiz_questions_for_taking` prefers an `answers` column
(`[{id, text, correct}]`) and falls back to `options` + `correct_answer`.
Seeding only the legacy pair works, but leaves the fixture on a path the app no
longer produces — and any row that happens to carry `answers` silently wins.
Seed the preferred shape and mirror it into the legacy columns.

`correct_answer` is jsonb: a bare `''` folds to `''::jsonb` at parse time, which
is what made **every quiz on the platform** throw 22P02. Use
`correct_answer #>> '{}'` to compare as text.

## Fixtures

A placeholder like `'test-module-id'` looks like an obvious "you forgot to seed
this". In practice Postgres rejects the non-UUID with 22P02, the page never
fetches, and the spec asserts against an error state and passes. Eight route
builders were affected. If a fixture default is not a real row, seed the row —
do not suppress the error it produces.

Verify a fixture through the interface the app uses. `verify-fixtures.mjs`
originally checked that quiz question rows existed; they did, and the quiz was
still unanswerable because the RPC reads a column the seed never set.

## Playwright

- `page.goto` defaults to `waitUntil: 'load'`, which waits for **every**
  subresource, so one slow third-party script gates the entire suite. Measured:
  `/login` timed out at 25s unblocked, loaded in 630ms blocked.
- `--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost` makes the browser
  hermetic. Two traps:
  - it applies to **IP literals as well as hostnames**, so `http://127.0.0.1:PORT`
    gets remapped — address local services by the excluded *name*;
  - an `EXCLUDE` clause Chromium cannot parse makes it **discard the whole rule
    string**, silently, so nothing is blocked and the timeouts return.
- It must **not** apply in CI: blocking fonts and images changes what every page
  renders, so every visual baseline captured that way is wrong.
- Firefox ignores that flag; use `firefoxUserPrefs` with `network.proxy.*`
  pointed at a closed port and `no_proxies_on` for loopback.
- `storageState` is **origin-scoped** and its tokens expire in about an hour.
  Stale sessions look exactly like a permissions defect.
- Playwright **wipes `test-results/` at the start of every run** — never write
  diagnostics there. `.e2e-audit/` is used here instead.
- Project `testMatch`/`testIgnore` decide which role a spec runs as. Overlap
  between projects silently duplicates executions (~44 of them, once).
- `reuseExistingServer: true` on `webServer` lets CI's own preview server win
  instead of fighting for the port.

## Vitest

- `src/test/setup.ts` **globally mocks** `@/integrations/supabase/client`. To
  test the real module you need `vi.importActual`.
- `resetSupabaseMock()` must clear call history, not just swap the builder.
  `mockReturnValue` alone leaves `from.mock.calls` accumulating across a file,
  so `expect(from).not.toHaveBeenCalledWith(...)` reports a call an earlier test
  made — an assertion that cannot pass.
- Coverage `include` is `src/**` only; `e2e/**` is excluded. A predicate that
  needs unit tests has to live under `src/`.

## The remote sandbox

- Outbound HTTPS goes through an agent proxy; `/root/.ccr/README.md` documents
  the failure classes and `$HTTPS_PROXY/__agentproxy/status` reports recent
  proxy-side failures. **Read it before improvising.**
- Node's fetch works through it. **Chromium's HTTPS CONNECT does not** — it
  never reaches the proxy and is reset, in every configuration tried. Hence
  `scripts/e2e/supabase-relay.mjs`.
- `$HTTPS_PROXY` **changes port between bash invocations.** Do not cache it.
- The Supabase CLI (a Go binary) cannot reach the API through the proxy either,
  so `supabase gen types` fails; the management API's
  `/v1/projects/{ref}/types/typescript` endpoint works from Node.
- WebSocket upgrades are not supported, so Supabase realtime cannot be relayed.
  All 8 `.channel()` call sites fetch first and subscribe second, so pages still
  render — only live-update behaviour is unavailable.

## Commands

```bash
npm run audit          # queries + types drift + invariants + fixtures + functions
npm run e2e            # suite against a directly-reachable Supabase
npm run e2e:relay      # suite via the loopback relay (restricted egress)
```

## CodeQL and GitHub Actions

- **CodeQL reports findings as check-run annotations**, which appear in none of
  the places the API exposes: not `output.text`, not the job log, not as review
  comments on the API's review endpoint. A red CodeQL check is undiagnosable
  from anything a CLI can fetch unless the workflow prints the SARIF itself.
- **Query metadata lives in `runs[].tool.extensions[].rules`**, not
  `tool.driver.rules`, which is typically empty. Read both, or every finding
  resolves to a default severity.
- **`security-severity` bands**: ≥9 critical, ≥7 high, ≥4 medium. Quality rules
  from the `security-and-quality` suite carry no score at all — fall back to
  `defaultConfiguration.level` and sort them separately.
- **`github/codeql-action/analyze` takes an `output` path**, so the SARIF can be
  summarised and uploaded as an artifact in later steps.
- **The job-log API returns a window from the end of the log.** Anything that
  must be readable has to finish there. This is why the E2E job tees its failure
  list to stdout as its last step.
- **`node -e "…"` inside a YAML `run:` block is a double-quoted bash string.** A
  double quote anywhere in it — including inside a JavaScript comment — ends the
  string and the script fails to parse.

## Supabase auth under CI load

- Signing in three roles across four parallel workers, repeated across many runs
  in an hour, trips auth rate limiting. It surfaces as `403` on `auth/v1/user`
  and `401` from Edge Functions — auth-shaped failures scattered across specs
  that passed on the previous commit. It clears on its own; the tell is that a
  manual sign-in immediately afterwards succeeds.

## tsconfig scope

- `e2e/**` is outside the tsconfig, so `npx tsc --noEmit` does **not** type-check
  or even parse the Playwright specs and helpers. Use `npx eslint` on those
  paths; a clean tsc says nothing about them.
