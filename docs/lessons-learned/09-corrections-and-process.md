# Corrections, and the process steps that cost most when skipped

From the query-audit session. The first half records the points where the user
pushed back and the pushback changed the outcome — the *pattern* of each mistake
is more useful than its fix. The second half is the process order that, when
skipped, produced those mistakes.

## Corrections

### "are you sure those are legacy? don't they exist today?"

**What I did.** Grouped `CodePractice.tsx` and `MockInterviews.tsx` with a batch
of dead modules and proposed deleting them as legacy.

**What was true.** The *features* are live at `/interview-prep/*`. What was dead
was an older duplicate copy of each. I had conflated "this file is unreferenced"
with "this feature is gone."

**The lesson.** Unreferenced ≠ unused ≠ unwanted. Before calling something
legacy, name the thing that replaced it and confirm the replacement is routed.
Say "superseded by X" or do not say it.

### "course settings is still needed — will courses have a settings option?"

**What I did.** Proposed deleting the 15 unreachable `course/management/*` files
because the builder replaced them.

**What was true.** The builder replaced most of it, but had no Settings section
at all, and **course deletion existed nowhere in the live app** — the file I was
deleting held the only working implementation.

**The lesson.** A reachability check tells you what runs. It does not tell you
whether a capability survived. Enumerate the actions, not just the files. (The
same investigation found the old settings save was a `setTimeout` and a fake
toast, so the honest outcome was "delete it *and* build the real thing", not
either one alone.)

### "can't I generate a token, or why can't we use VITE_SUPABASE_PUBLISHABLE_KEY?"

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

### "I need a full evaluation … every query that the code runs also tested for validity"

**What I did.** Would have sampled.

**What was true.** Exhaustive replay against the live database found 21 broken
shapes. Several were in code that looked completely healthy by inspection,
including two pages that returned 42703 on every load while the e2e suite stayed
green.

**The lesson.** For "does this actually work against the real system", sampling
answers a different question. The full sweep was tractable — 305 distinct shapes
after deduplication from 702 call sites — and is now a CI job.

### "fix everything, I want a clean state"

**What I did.** Was inclined to report the remaining failures with explanations.

**What was true.** Several "environmental" failures were real defects wearing an
environmental costume — including a platform-wide quiz outage where *every* quiz
threw 22P02 because the live function had drifted from the repo and did
`COALESCE(jsonb, '')`, folding `''::jsonb` at parse time.

**The lesson.** "Probably environmental" is a hypothesis, not a conclusion.
Confirm it the way the sandbox-network claim eventually was: show an untouched
control failing the same way, and a different client succeeding.

### The pattern across all of them

Every correction was the same shape: **a conclusion drawn from a proxy signal
instead of the thing itself.**

| proxy signal | what it does not tell you |
|---|---|
| file is unreferenced | the feature is gone |
| tests are green | the code works |
| a query looks fine | the database accepts it |
| a credential would work | it is the least authority that works |
| a failure looks environmental | it is not a defect |

When the user pushes back on a claim, the fastest response is usually not to
defend it — it is to go and check the thing the claim was standing in for.

---

## Process

### Read the environment's own documentation before improvising

Chromium could not reach the network. I tried five proxy configurations, tried
adding a CA to the NSS store (which hung), and only then read
`/root/.ccr/README.md` — which has a section titled "405 Method Not Allowed from
the proxy" describing exactly the symptom, and a "report it, do not work around
it" instruction for that class of failure.

Reading it first would have saved most of an hour and pointed straight at the
diagnostic that finally explained the behaviour (`recentRelayFailures` in the
status endpoint): Chromium's plain-HTTP requests reached the proxy and were
logged; its HTTPS CONNECT never arrived at all.

**When a tool misbehaves in an unfamiliar environment, find the environment's
docs before the third attempt.**

### Fix the order dependencies, not just the items

The harness work had a strict order, and the order was the point:

1. real fixture IDs
2. *then* narrow the console suppressions
3. *then* the lint rule

Doing (2) first would have buried real defects under noise from the placeholder
IDs — which is exactly why the blanket suppressions were written in the first
place. The suppressions were a symptom; the placeholders were the cause.
Removing a symptom before its cause just recreates the symptom.

**If you are about to remove a workaround, find what it was working around.**

### Change one thing when diagnosing

I verified `--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost` worked
(25s timeout → 630ms), then added `,EXCLUDE 127.0.0.1` for "safety" before
shipping. Chromium discards the entire rule string when it cannot parse a
clause, so nothing was blocked, the timeouts came back, and I spent the next
several minutes doubting whether `launchOptions` reached the browser at all.

The untested addition was the bug. **Do not add to a thing you just measured.**

### State the assumption, then check it

Several long detours came from an unstated assumption:

- "storageState is origin-scoped, so `127.0.0.1` vs `localhost` matters" — true,
  but not the actual cause; the session had simply expired.
- "`launchOptions` at the top-level `use` must not be reaching the browser" — it
  was; the rule string was malformed.
- "the CLI and the management API produce identical types output" —
  unverifiable in that sandbox, which is precisely why the drift check compares
  *meaning* against the live catalogue instead of diffing generator bytes.

Writing the assumption down turns it into something testable in one command.

### Suspect the tool first

The audit tooling produced several confident, wrong answers, each of which would
have caused a wrong fix:

- **unbounded lookahead** for `.select()` attributed the *next* query's columns
  to the current one, inventing `notifications.due_date`;
- **RPC existence by calling with no args** — PostgREST answers PGRST202
  "without parameters" for anything that merely *requires* arguments, giving 22
  false MISSING. Fixed by reading `pg_proc`;
- **whitespace** — postgrest-js strips it outside quotes before sending, so the
  raw template returned 200 while the string actually sent returned 42703;
- **comments** — the inventory scanned commented-out code and reported a table
  that never existed as a broken shape in live code.

A diagnostic that produces false defects is worse than no diagnostic, because it
spends attention on nothing.

### Prove the check can fail

A gate nobody has seen fail is a gate nobody knows works. Every check here was
verified in both directions:

| check | positive | negative |
|---|---|---|
| CI query gate | 305 shapes, 0 reachable failures | reintroduced `profiles.full_name` → exit 1, named the route |
| types drift | clean against live catalogue | planted a stale column → exit 1 |
| invariants | 4/4 hold | ran the predicate with one profile masked → returns 1 |
| wiring guard | passes | removed `global.fetch` from `client.ts` → failed with the intended message |
| interceptor | quiet on healthy writes | member deleting another user's certificate → `empty-write` recorded |

### Do not use a destructive statement to test a monitor

To prove the "every auth user has a profile" invariant could fire, the obvious
move is deleting a profile inside a rolled-back transaction. The permission
classifier blocked it, and it was right to.

The same proof is available read-only: run the invariant's predicate against a
catalogue with one profile masked out and check it returns 1. Zero risk, same
information. **If the only proof you can think of is destructive, think again.**

### Clean up probe data immediately, and sweep at the end

Probing a live database leaves rows behind — here, a `Probe Mod2` module at
position 99 inside the reference course, which would have appeared in the module
list and in visual baselines. A read-only sweep for probe-shaped rows before
finishing found it.

Some leftovers turn out to be useful: a `Foundations Check-in` quiz created
during an earlier investigation was exactly the fixture the specs needed, so it
was promoted into `seed.sql` with stable IDs. Undocumented drift became a
documented fixture.

### Let the tooling own the lifecycle

Several rounds went into starting and killing dev servers and relays by hand,
including one `pkill` that killed its own shell. Playwright's `webServer` option
exists for this; once it owned startup — with `reuseExistingServer: true` so
CI's own preview server wins — the problem disappeared.

### Green is not evidence

Three times a suite went green while the app had **no data at all**: an expired
`storageState`, the relay remapped by `MAP *`, and the CSP blocking the relay
with a bare `TypeError: Failed to fetch`. Each time the output said pass.

The catch is a **positive assertion that data arrived**, not the absence of
failure — `relay responses: 45 ok, 0 failed`, and a page quoting seeded content.
After any infrastructure change, ask how many successful data requests the page
actually made. Zero is the answer that matters.
