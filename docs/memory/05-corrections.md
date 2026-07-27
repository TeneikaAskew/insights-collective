# Corrections and redirections

Each of these was a point where the user pushed back and the pushback changed the
outcome. They are recorded because the *pattern* of each mistake is more useful
than the specific fix.

## "are you sure those are legacy? don't they exist today?"

**What I did.** Grouped `CodePractice.tsx` and `MockInterviews.tsx` with a batch
of dead modules and proposed deleting them as legacy.

**What was true.** The *features* are live at `/interview-prep/*`. What was dead
was an older duplicate copy of each. I had conflated "this file is unreferenced"
with "this feature is gone."

**The lesson.** Unreferenced ≠ unused ≠ unwanted. Before calling something
legacy, name the thing that replaced it and confirm the replacement is routed.
Say "superseded by X" or do not say it.

## "course settings is still needed — will courses have a settings option?"

**What I did.** Proposed deleting the 15 unreachable `course/management/*` files
because the builder replaced them.

**What was true.** The builder replaced most of it, but had no Settings section
at all, and **course deletion existed nowhere in the live app** — the file I was
deleting held the only working implementation.

**The lesson.** A reachability check tells you what runs. It does not tell you
whether a capability survived. Enumerate the actions, not just the files. (The
same investigation found the old settings save was a `setTimeout` and a fake
toast — so the honest outcome was "delete it *and* build the real thing", not
either one alone.)

## "can't I generate a token, or why can't we use VITE_SUPABASE_PUBLISHABLE_KEY?"

**What I did.** Assumed the audit needed a Supabase management token because
`pg_proc` is not reachable over PostgREST.

**What was true.** The *permissions* were never the problem. Verified with
`set local role authenticated`: that role can already read `pg_proc`,
`pg_constraint`, `pg_policy` and `information_schema`. Only `auth.users` is
denied. The catalogs were unreachable, not unauthorised — and a view in `public`
with `security_invoker = true` fixes reachability with no new privilege at all.

Result: no management token in any workflow. CI signs in with credentials it
already had.

**The lesson.** "I can't get at X" usually decomposes into *can't reach* and
*can't read*. They have very different fixes, and reaching for the more powerful
credential is the expensive way to avoid asking which one you have.

## "I need a full evaluation … every query that the code runs also tested for validity"

**What I did.** Would have sampled.

**What was true.** Exhaustive replay against the live database found 21 broken
shapes. Several were in code that looked completely healthy by inspection,
including two pages that returned 42703 on every load while the e2e suite stayed
green.

**The lesson.** For "does this actually work against the real system", sampling
answers a different question. The full sweep was tractable — 305 distinct shapes
after deduplication from 702 call sites — and is now a CI job.

## "fix everything, I want a clean state"

**What I did.** Was inclined to report the remaining failures with explanations.

**What was true.** Several "environmental" failures were real defects wearing an
environmental costume — including a platform-wide quiz outage where *every* quiz
threw 22P02 because the live function had drifted from the repo and did
`COALESCE(jsonb, '')`, folding `''::jsonb` at parse time.

**The lesson.** "Probably environmental" is a hypothesis, not a conclusion.
Confirm it the way the sandbox network claim was eventually confirmed: show an
untouched control failing the same way.

## The pattern across all of these

Every correction was the same shape: **I had drawn a conclusion from a proxy
signal instead of the thing itself.**

| proxy signal | what it does not tell you |
|---|---|
| file is unreferenced | the feature is gone |
| tests are green | the code works |
| a query looks fine | the database accepts it |
| a credential would work | it is the least authority that works |
| a failure looks environmental | it is not a defect |

When the user pushes back on a claim, the fastest response is usually not to
defend it — it is to go and check the thing the claim was standing in for.
