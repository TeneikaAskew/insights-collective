# Silent failures, and the audit that found them

From the session that added the query-validity gate, the Supabase interceptor and
the e2e relay. It follows on from `00-verification-discipline.md` rather than
repeating it — the discipline is the same, but the failure *shape* here is
specific enough to be worth naming.

## Everything found was the same bug

Twenty-one broken query shapes, a platform-wide quiz outage, an admin action
that deleted nothing, and three pages that failed on every load. Not one of them
threw. Every single one **reported success while doing nothing.**

That shape has four recurring sources in this codebase:

| source | why it is silent |
|---|---|
| PostgREST answers 200/204 when RLS filtered every row | `if (error)` passes; the UI toasts success |
| A rejected query renders as an empty list | "no results" and "42703" look identical |
| A mocked client accepts any function name | 893 tests green against a function that never existed |
| `if (await x.count() > 0) { expect(…) }` | the branch does not run, so the assertion cannot fail |

More logging would not have caught any of it. The errors *were* already
logged — `[CanvasQuizResults] Error loading quiz results` printed on every run of
a **passing** test. Prose in a console is not a signal; a structured record a
test can read is.

## Make writes report what they changed

`Prefer: count=exact` makes PostgREST return the affected row count in
`Content-Range`. Verified against the live project: a DELETE that matches
answers `*/1`, one that matches nothing `*/0`, a permitted PATCH `0-0/1`, and an
RLS-filtered PATCH `*/0`.

Measured cost on the hottest write path (the `content_item_progressions` upsert
behind "mark as done", 150 interleaved samples per arm): **+0.3ms median on a
68ms round trip**, +0.8ms trimmed mean. The count comes from the same statement
as the write, so there is no second query.

Use a **trimmed mean** for anything crossing a network. The first run of this
benchmark reported "+11.3ms mean" next to "-0.6ms median" — one 300ms outlier
wearing a decimal point.

## Structural errors are not data conditions

These codes always mean the code asked for something that does not exist, so
they can never be "expected in the test environment":

`42703` column · `42P01` relation · `22P02` invalid uuid syntax ·
`PGRST200` unresolvable embed · `PGRST204` column not in cache ·
`PGRST202` no such function

Deliberately **not** in that set: `PGRST116` (`.single()` matched no rows — a
data question) and 401/403, which are the correct answer when a role lacks
access. A predicate that flags those is the blanket-suppression's mirror image
and gets switched off within a week.

## Fourteen of twenty-one were one mistake

PostgREST cannot embed `profiles` through a foreign key that points at
`auth.users`:

```ts
profiles!content_discussions_user_id_fkey(...)          // → auth.users → PGRST200
profiles!content_discussions_user_id_profiles_fkey(...) // → profiles   → works
```

Two thirds of the broken shapes were that single confusion, repeated. When a
sweep turns up a pile of defects, group them before fixing them — the durable
fix here was one migration adding real FKs from nine tables to `public.profiles`
(after backfilling 21 historical users), not fourteen edited call sites.

## A placeholder can read as a signal and behave as its opposite

`'test-module-id'` looks like an obvious "you forgot to seed this". In practice
Postgres rejects the non-UUID with 22P02, the page never fetches, and the spec
asserts against an error state and passes. Eight route builders were affected.

If a fixture default is not a real row, seed the row. Do not suppress the error
it produces.

## A global interceptor's first catch may be itself

The interceptor added to prevent silent failures introduced one. It appended
`Prefer: count=exact` to *every* write, including Edge Function calls — where
the header means nothing and is not CORS-safelisted, so the browser preflighted
it and the function's `Access-Control-Allow-Headers` did not list `prefer`.
Every `messages-helper` call was blocked. The whole messaging feature.

Nothing else could have found it: unit tests mock fetch, and the query gate only
replays PostgREST shapes. It took a real browser making a real cross-origin
request.

Two things follow. A choke point is powerful *because* nothing can opt out,
which means a mistake in it reaches everything — scope changes to the narrowest
layer that needs them. And when a new safety net's first catch is the net, that
is the net working, not an embarrassment.

## Third parties must not decide whether the suite passes

`page.goto` waits for `load`, which waits for every subresource. This app pulls
two third-party resources on every page — Lovable's editor script
(`index.html:26`) and a render-blocking Google Fonts `@import`
(`src/index.css:1`) — so either one being slow gates every navigation in the
suite. Measured: `/login` timed out at 25s unreachable, loaded in 630ms blocked.

The fix is a hermetic browser (`--host-resolver-rules`), with two traps worth
knowing:

- it applies to **IP literals as well as hostnames**, so a local service
  addressed as `127.0.0.1:PORT` gets remapped to a closed port — use the
  excluded *name*;
- an `EXCLUDE` clause Chromium cannot parse makes it **discard the whole rule
  string**, silently, so nothing is blocked and the timeouts return.

And it must not apply in CI: blocking fonts and images changes what every page
renders, so a suite that blocks them screenshots a different application than
users see and **every visual baseline captured that way is wrong.**

## Unreferenced is not the same as removed

A reachability check tells you what *runs*. It does not tell you whether a
*capability* survived.

`course/management/*` was 15 files no route could reach, superseded by the
course builder — a clean deletion. Except its settings form's save was a
placeholder (`setTimeout` plus a success toast, against a table that never
existed), while its **delete-course action genuinely worked and nothing had
replaced it.** Deleting the folder would have removed the only way to delete a
course anywhere in the app.

Enumerate the *actions*, not the files, and check each one landed somewhere.

## Landing a rule against an existing backlog

The `if (await x.count() > 0)` guard had 159 instances. Three of the four
obvious options fail: failing lint everywhere gets the rule reverted, excluding
the directory hides the debt, and fixing all 159 first means the rule never
lands.

What worked: land the rule, and give each existing instance a one-time
`eslint-disable` with a `TODO(count-guard)`. New ones are blocked immediately
and the backlog is one greppable number.

Two selectors were needed — the comparison form and the bare
`if (await x.count())` truthiness form are different AST nodes, and the second
would otherwise have been the way back in.

## A mock must reject what the real thing rejects

`rpc: vi.fn()` returned `{data: null, error: null}` for any string. That is how
893 tests stayed green against `select_random_questions`, a function that had
never been created. The mock now checks names against a checked-in catalogue
that CI verifies is current.

Related, and found by writing a test for it: `resetSupabaseMock()` swapped the
query builder but never cleared `from`'s call history, so it accumulated across
a file and `expect(from).not.toHaveBeenCalledWith(...)` reported a call an
earlier test had made. That assertion could not pass, whatever the code did.
