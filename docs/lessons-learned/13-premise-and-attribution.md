# Premise verification and change attribution

Written from the PR #32 session (Featured Courses + the Codex review round).
The earlier files are mostly about verifying *tools*. This one is about
verifying **the claim that something is broken** — a different and, as it turned
out, easier thing to get wrong.

## The headline mistake: proving the fix without proving the bug

The change removed a fatal `enrollments` query from `CourseList` and made the
equivalent query non-fatal in `CourseDetail`. The reasoning was checked three
independent ways, and all three held:

```
GET /rest/v1/enrollments  (anon key)  → 401 {"code":"42501"}
information_schema.role_table_grants  → anon has INSERT/UPDATE/DELETE, no SELECT
supabase-js, app's exact client+query → { data: null, error: 42501 }
```

The *after* state was verified too — unit tests, plus a real browser rendering
the live anon payload with `enrollments` stubbed to 401: five cards, no error
state.

What was **never** verified: that the page was actually broken *before the
change, in the environment where the tests run*. It was inferred from reading
`if (enrollError) throw enrollError` and the render chain
(`loading → error → grid`). The inference is sound in isolation and still didn't
establish the claim, because CI said otherwise:

```
run 181 (276998c, pre-change):  ✓ courses-catalog @ /courses [public] (2.4s)
run 182 (09fdf67, post-change): ✘ 218706 pixels (ratio 0.22) are different
```

A public, unauthenticated screenshot test of `/courses` was **green** on the
commit where that route was supposedly showing an error page to every anonymous
visitor. That is direct evidence against the premise, and it existed before the
change was written.

**The check that would have caught it, before touching any code:**

```bash
grep -rn "/courses" e2e/ --include=*.ts | grep -i "public\|visual"
```

One command. It would have surfaced a green public test covering the exact route
and role being described as broken, and turned "this page is broken for anon"
into "this page is broken for anon, but something is keeping a test green —
find out what before proceeding."

**Rule:** when claiming a change *fixes* something, verify the **before** state
with the same rigour as the after. "I read the code and it must fail" is a
hypothesis. Existing green tests over the same route and role are evidence, and
evidence outranks inference.

## A passing test that contradicts your model is data, not noise

The instinct on seeing run 182's failure was "my change altered the page, so the
baseline is stale — regenerate it." That story is self-consistent and fits the
new failure perfectly. It does not fit run 181 passing.

Both facts have to be explained. A model that explains only the convenient one
is not a model. The honest position at the end was:

- verified: `anon` cannot read `enrollments` (three ways)
- verified: the old code turns that error into a full-page error state
- verified: the new code renders the catalog
- **contradicted:** a public visual test of that route was green pre-change
- **unavailable:** CI's `VITE_SUPABASE_URL` is a masked secret, and this sandbox
  blocks browser egress to Supabase, so CI could not be reproduced locally

That was reported as an open contradiction with a question, rather than
resolved by picking the hypothesis that flattered the change.

**Rule:** never let a tidy story override a fact it cannot account for. If one
piece of evidence doesn't fit, say so explicitly and stop, rather than
discovering later that it was the only piece that mattered.

## Verification is scoped to the environment you ran it in

Every probe above hit the production project `siuqvhscuiycvdrtiqsh`, using the
anon key from `src/config/security.ts`. The E2E workflow's `VITE_SUPABASE_URL`
is **masked** in the log. So "anon cannot read enrollments" was proven for the
environment probed, and merely *assumed* for the one where the tests run.

That distinction was collapsed when writing the PR comment, which stated the
consequence for CI as established fact.

Related discovery, worth its own note: the workflow sets

```yaml
VITE_SUPABASE_PUBLISHABLE_KEY: ***
```

but `src/config/security.ts` reads

```ts
import.meta.env.VITE_SUPABASE_ANON_KEY || "<hardcoded anon key>"
```

Different variable names. The value CI carefully injects is never read; the app
silently falls back to the key compiled into the source. Nothing fails, nothing
warns — the fallback makes the misconfiguration invisible. Any future attempt to
point CI at a different Supabase project by setting that variable will appear to
work and won't.

**Rule:** state which environment a verification covers. And when an env var
feeds a fallback, confirm the *name* matches what the code reads — a silent
fallback turns a config error into a permanent, invisible one.

## Before preserving a behaviour, check whether anything consumes it

`CourseList` computed `enrollmentCount` per course and assigned it to every card
object. A comment defended making its failure fatal:

```
// A failed count query is a real fetch failure — surface it through
// the page error/retry UI instead of rendering misleading 0-enrolled cards.
```

The field is never rendered on that page:

```bash
grep -n "enrollmentCount" src/pages/CourseList.tsx
# 74:  enrollmentCount: enrollCounts.get(c.id) ?? 0     ← the only hit
```

A cross-user query, on a public page, capable of taking the whole catalog down,
feeding a value nothing displays. Deleting it was strictly better than making it
non-fatal. `CourseDetail` renders its count in three places, so that one was
made non-fatal instead — the same evidence produced different fixes.

**Rule:** before working *around* a value, grep whether anything consumes it.
The answer changes the fix, and sometimes deletes the problem.

## Trace the mechanism before calling a failure flaky

`code-evaluation.spec.ts` failed on `getByText('Result')` with
**`element(s) not found`** — the results card never mounted, rather than
mounting slowly. `CodePractice.tsx` explains that precisely: when `review-code`
errors, `handleSubmit` catches, fires a toast, and never calls `setFeedback`, so
`showFeedback` stays false.

That mechanism plus the run history (`✘ ✘ ✘ ✓ ✘`) supported "external dependency,
not this diff" — and the next run passed it, confirming the call.

The distinction that matters: **"I traced the code path that produces this exact
symptom and it depends on a third-party service"** is a finding.
**"It passed last time"** is a guess. Only the first justifies not fixing it.
A prior session in this repo called a failure flaky without tracing it and was
wrong; the difference is the trace, not the confidence.

## Corollary: an unrendered field and a stale baseline look identical in a diff

Both of this session's Codex findings were real and both were verified before
acting — that part worked (see `06`). What the verification *didn't* cover was
the second-order effect: fixing P1 changed what `/courses` renders, which
invalidated a committed baseline, which produced a red check that then needed
its own investigation.

**Rule:** when a fix changes what a page renders, check what has photographed
that page before you push. `ls e2e/visual/*snapshots*/` is one command and would
have predicted the failure instead of reacting to it.
