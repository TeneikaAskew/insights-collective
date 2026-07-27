# Failure modes this codebase actually produces

Every defect found in the audit was a variation on one theme: **success was
reported for work that did not happen.** Not crashes, not stack traces — silence.

## 1. The silent write

PostgREST returns 200/204 when RLS filtered every row. The client sees
`error === null` and the UI toasts success.

```ts
const { error } = await supabase.from('certificates').delete().eq('id', id);
if (error) throw error;
toast({ title: 'Certificate revoked' });   // deleted nothing
```

Admins could not see or revoke *any* certificate for months. The code was
correct; the policy was missing.

**Detection.** Ask PostgREST for the count and check it:

```ts
const { error, count } = await supabase.from('courses').delete({ count: 'exact' }).eq('id', id);
if (error) throw error;
if (!count) throw new Error('Nothing was deleted — you may not have permission.');
```

`src/integrations/supabase/instrumentation.ts` now adds `Prefer: count=exact` to
every write globally, so no call site has to remember. Cost, measured on the
hottest path: **+0.3ms median on a 68ms round trip.** The count comes from the
same statement as the write — there is no second query.

## 2. The rejected query that looks like empty data

`select('id, full_name, email')` against a table whose column is `first_name`
returns 42703. The component catches it, logs it, and renders an empty list.
Empty list is indistinguishable from "no results", so nobody notices.

Codes that always mean this — never a data condition, never a permission outcome:

| code | meaning |
|---|---|
| `42703` | column does not exist |
| `42P01` | relation does not exist |
| `22P02` | invalid input syntax (a non-UUID reached a uuid column) |
| `PGRST200` | embed cannot be resolved — no such relationship |
| `PGRST204` | column not in the schema cache |
| `PGRST202` | no such function |

Deliberately **not** in that list: `PGRST116` (`.single()` matched no rows — a
data question) and 401/403 (the correct answer when a role lacks access). A
predicate that flags those gets switched off within a week.

## 3. The embed through the wrong foreign key

PostgREST cannot embed `profiles` through a key that points at `auth.users`.
Fourteen of twenty-one broken query shapes were this one mistake.

```ts
profiles!content_discussions_user_id_fkey(...)          // → auth.users → PGRST200
profiles!content_discussions_user_id_profiles_fkey(...) // → profiles   → works
```

The durable fix was adding real FKs from nine tables to `public.profiles`
(migration `20260731000000`), which required backfilling 21 historical users
first. `NOT VALID` then `VALIDATE CONSTRAINT` keeps the lock short.

## 4. The assertion that cannot fail

```ts
if ((await thing.count()) > 0) {
  await expect(thing).toBeVisible();
}
```

Passes whether the feature works or is entirely absent — the branch simply does
not run. There were **159** of these. They are a large part of why 99 specs
survived five column bugs: the pages rendered nothing, every count was 0, every
assertion was skipped.

Now banned by `no-restricted-syntax` in `eslint.config.js`, with two selectors —
the comparison form *and* the bare `if (await x.count())` truthiness form, which
is a different AST node and would otherwise have been the way back in.

What to write instead:
- must exist → `await expect(thing).toBeVisible()`
- legitimately varies → assert both branches, so one must hold
- depends on seed data → seed the row and assert unconditionally

## 5. The mock that accepts anything

`rpc: vi.fn()` returned `{data: null, error: null}` for any string. 893 tests were
green against `select_random_questions`, a function that had never been created.

A mock's job is to stand in for the real thing, which means **rejecting what the
real thing would reject.**

## 6. The placeholder that reads as a signal but behaves as the opposite

`'test-module-id'` looks like an obvious "you forgot to seed this". In practice
Postgres rejects a non-UUID with 22P02, the page never fetches, and the spec
asserts against an error state and passes. Eight route builders were affected.

If a fixture default is not a real row, seed the row. Do not suppress the error
it produces.

## 7. The form that pretends to save

`CourseSettings.tsx` had its write commented out and replaced with
`await new Promise(r => setTimeout(r, 1000))`, then toasted "Settings have been
updated successfully". The table it claimed to write to never existed.

If a control cannot yet do what it says, either do not ship it or label it —
`CourseCertificatesView.tsx` has a good precedent: a permanent notice saying the
values save but nothing consumes them yet.

## The general rule

More logging would not have caught any of these. The errors were already logged —
`[CanvasQuizResults] Error loading quiz results` printed on every run of a
*passing* test.

What was missing was a place that sees every request, emits **structured fields
rather than prose**, and can be read by a test. Suppression rules that match on
message text have to guess how a message was worded, and an error's severity has
nothing to do with which component logged it.
