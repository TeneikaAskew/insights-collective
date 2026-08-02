# When the tooling lies

From the second half of the query-audit session: reconciling with main, taking
a PR through review, and building the instrument that finally made a red
security check readable.

Files 08–11 are about defects in the *product*. This one is about defects in
the *instruments* — the gates, readers and harnesses built to find defects. It
is the least flattering file here and the most useful, because every entry is
the same shape as the bug the tool was built to catch.

## A zero from a broken reader looks exactly like a clean scan

CodeQL reported 2 high and 17 medium. The summariser I wrote to read those
alerts printed `=== security findings (0) ===`.

The scan was not clean. CodeQL puts query metadata in
`runs[].tool.extensions[].rules` and leaves `tool.driver.rules` empty; the
lookup read only the driver, resolved nothing, and every finding fell through
to a `note` default that cleared no threshold.

The evidence was in the output the whole time: **every** result was labeled
`note`, including rules that are errors by definition. I read past it, because
a zero in a security summary is the answer you are hoping for.

The fix that matters is not the lookup. It is that the recap now distinguishes
*no findings* from *no resolvable metadata*:

```
=== security findings (0) ===
  WARNING: no rule metadata resolved from this SARIF;
  severities above are defaults, not real values.
```

**Every count a tool reports needs a way to say "I could not tell."** A gate
that returns zero when it cannot read its input is the silent-success pattern,
inside the thing built to stop the silent-success pattern.

## Being able to produce output is not being able to read it

The first version of that summariser worked and was still useless. It sorted
highest-severity first, and the GitHub log API returns a window from the **end**
of a job log. With 22 results at three lines each, the highs were the furthest
thing from the window: fetching the log returned page after page of
`js/unused-local-variable` and none of the two alerts the check was failing on.

The E2E job in this repo already had a comment describing this exact trap —
"the only record of WHICH tests failed is the JSON reporter dump, which the API
truncates away" — and I walked into it while fixing the equivalent gap for
CodeQL.

**Put the conclusion where the reader's window lands.** For a log API that
tails, that means last.

## When two fixes make the signal worse, the framing is wrong

The console-error suppression list matched vendor hosts with bare substrings,
so `/google-analytics\.com/` also matched `evil-google-analytics.com`. The
comment above it claimed the entries were "anchored to real vendors" — asserting
a property the code did not have.

- **Attempt 1:** rewrite with lookbehind/lookahead. Semantically correct,
  verified in both directions. CodeQL's `js/regex/missing-regexp-anchor` only
  recognises `^`-style anchors, so it flagged every rewritten entry — and
  splitting one `/segment\.(io|com)/` into two calls turned **2 alerts into 4**.
- **Attempt 2 was not attempted.** Anchoring to `^` is simply wrong here: these
  match anywhere inside a console message, not a whole URL.

That was the tell. **Host comparison was never a regex problem**, and two
rounds went into solving it as one. The list now splits the message on
characters that cannot appear in a hostname and compares candidates as hosts —
exact match or a proper `.host` suffix. The lookalike domains fail by
construction rather than by pattern, and there is no anchor to get wrong.

When a fix makes a signal *worse* twice, stop refining the fix and re-examine
the category the problem was filed under.

## A rule that fires on ordinary data is a rule someone switches off

The write-instrumentation flagged `POST /rest/v1/rpc/form_submission_counts` as
a write that changed nothing, failing two admin specs on every run.

`supabase.rpc()` POSTs, and it POSTs under `/rest/v1/`, so both tests for "is
this a PostgREST write?" said yes. But a function call is not a write: for a
set-returning function PostgREST reports rows *returned*, so a read-only
counting RPC with nothing to count answers zero. Ordinary data, wearing the
exact shape of the defect the rule exists to catch.

This is the same mistake as flagging `PGRST116`. The value of a structural rule
is that everything it reports is a defect **by definition**, and that only holds
if it never fires on data. One false positive per run is how a rule gets
disabled, taking its real coverage with it.

Corollary, from landing the count-guard lint rule against main's specs: when a
rule over-matches a legitimate pattern, exempt the instance **with its reason**,
not with the blanket TODO used for genuine debt. `if/else` that asserts in both
branches, and conditional *setup* rather than a conditional assertion, are both
legitimate — and a reader needs to know which exemptions are debt and which are
by design.

## Gate the siblings, not just the one you were looking at

`hermeticArgs()` blocks third parties only under `E2E_USE_RELAY=1`, because
blocking fonts in CI would invalidate every visual baseline. The Firefox
equivalent — a proxy at a closed port, since Firefox ignores
`--host-resolver-rules` — was written at the same time and **not gated the same
way**.

So in CI, Firefox sent every HTTPS host to port 1, including the project. Global
setup authenticates in Node and hands Firefox a stored token, so the pages
rendered while every data request died: **17 CI failures, all
`CORS request did not succeed`**. Without the console check, those specs would
have passed against an empty app.

When you make one thing conditional, find everything that implements the same
policy by another mechanism and make it conditional too.

## Point the gate at what the code actually uses

`npm run audit:types` validated `src/integrations/supabase/types.ts` against the
live database and passed. Meanwhile `client.ts` passed `Database` from
`@/types/supabase` — a hand-written 214-line subset — to `createClient`, so
**that** file typed every `.from()` call in the app.

The gate was holding the wrong declaration to the database and could pass with
the types the compiler actually applied fully stale.

The fix was not to teach the gate to parse a second file. Two competing
declarations of one schema is the defect; the client now uses the generated
file and the hand-written `Database` is gone. `tsc` was clean immediately,
which is the argument for doing it properly rather than widening the gate.

Same shape, later the same session: `npx tsc --noEmit` reported clean on a file
I had just corrupted, because the tsconfig does not include `e2e/**`. **A green
check says nothing about code it does not cover** — confirm the check's scope
includes what you changed.

## Scripted edits deserve more scrutiny than manual ones

A script removed a duplicate helper by walking brace depth from the `export
async function` line. That function's parameters span several lines before the
opening `{`, so depth hit zero early and the deletion stopped mid-symbol,
leaving an orphaned `): Promise<string> {`, a body, and a duplicate const block.

It broke the build. Lint went red, CodeQL reported nine syntax errors, and
every journey spec importing that file would have failed.

I had linted the three files I edited by hand and not the one the script
edited — exactly backwards. A hand edit is reviewed as it is typed; a scripted
edit is not reviewed at all until something reads the result.

## Verify the tree you are measuring

A worker restart rolled this container's clone back to a commit from hours
earlier. I noticed only because the unit suite read **104 files / 928 tests**
against a remembered 108 / 971.

The right instinct there is not "flaky" — it is "which tree produced this
number?" Tracing it showed `git rev-parse` did not recognise commits I had
pushed. Nothing was lost, because everything was already pushed, but three
edits had been written on top of a stale tree and any measurement taken from it
was meaningless.

**A number is only as good as the revision it was measured on.** When a metric
moves without a cause, verify the inputs before diagnosing the subject.

## A hypothesis that explains the data is not a diagnosis

E2E started failing with `403` on `auth/v1/user` and 401s from an Edge
Function — auth-shaped failures across specs that had passed on the previous
commit. Eight CI runs in a few hours, each signing in three roles across four
parallel workers. Signing in by hand immediately afterwards worked, so it was
not a standing block.

I called it rate limiting caused by my own iteration, and said so twice. It
fit every observation I had.

**Two controls demolished it.** Main's CI ran in the same window against the
same project and came back 570 passed / 1 failed — so nothing global was
throttled. And a docs-only commit on my branch, byte-identical in product code
to the run before it, went from 6 failures to 2 — so it was not deterministic
either, and therefore not a branch defect.

Both controls were cheap and available before I made the claim. Neither
required new tooling: one was another branch's most recent run, the other was a
re-run I got for free by pushing documentation.

The honest statement was available all along and is shorter than the wrong one:
*intermittent, auth-shaped, cause not isolated.* A hypothesis consistent with
the evidence is worth stating as a hypothesis; calling it the cause needs a
control that would have distinguished it from the alternatives.

The narrower point still stands and is worth keeping: fixing a red check by
pushing again has a cost, and a re-run of unchanged code is the cheapest way to
tell flake from defect. Reach for it *before* theorising, not after.

## Trace statically when you cannot reproduce — and say that is what you did

A `22P02` on `/courses/<not-a-uuid>` reproduced in CI and nowhere else: not on
the dev server, not against a production preview build through the relay, not
running the whole file serially.

Rather than guess at a symptom I could not trigger, I traced it to the one
unguarded `courses`-by-id query reachable from a `:courseId` route whose select
shape matched the reported one — `useCourseData`, reached via `CourseSidebar`,
which `CourseDetail`'s own guard never covered.

The commit said plainly: *"If CI still reports it, the trace was wrong and the
next step is the error-context artifact, not another guess."* It was right, and
that sentence is what makes the difference between a trace and a guess.

## Resolve merges toward the better version, not your own

Main landed the same E2E diagnoses this branch had reached independently, so
most conflicts were two correct fixes for one defect.

Main's grading-token helper threw when no instructor password was configured;
mine fell back to a hardcoded `'TestPass123!'`. Main's `code-evaluation` fix
included the same `setTimeout` I had added **and** the root cause of a failure I
could not reproduce.

Taking theirs in both cases cost nothing and improved the result. Authorship is
not a tiebreaker; read both sides' intent and keep the better one, or the union
where they are independent.

## A check that cannot fail for the right reason is not a check

Six visual baselines screenshotted data-driven pages against a shared live
database. They already carried per-route `mask` selectors and a widened
tolerance for the worst three, and still failed at 11%–51% of pixels, stably,
across six consecutive runs.

At that point the check measures what the database happens to contain, not how
the app renders — and `--update-snapshots` would bake in one arbitrary moment of
that while discarding whatever the baseline protected. Six permanent red entries
train everyone to ignore the job.

The resolution was the user's call and it was the right one: drop the
data-driven routes, keep the ones whose rendering does not depend on mutable
data, and delete the per-route tolerance exemption that existed only for the
removed pages. Behaviour on those pages is still covered by the role-based specs
and the query gate. What is gone is the claim that a pixel diff on them meant
anything.

## Say when you were guessing

Asked what the remaining high-severity alerts were, I answered "probably SSRF on
the relay and path-injection in the audit scripts." That was inference stated
with more confidence than it deserved. When the summariser finally worked,
`js/request-forgery` did not appear anywhere.

Correcting it unprompted cost one paragraph. Leaving it would have had someone
searching the relay for a vulnerability that was never reported.

## A note about a limitation outlives the workaround that fixed it

CLAUDE.md carried this, as the closer to a section titled *Before claiming the
environment can't do something, run the command that would do it*:

> The one verified real limitation: browser HTTPS through the sandbox proxy
> stalls (curl works), which blocks signed-in E2E locally — and only that.

The first clause is true and still is. The second had stopped being true, in the
same repository, in `scripts/e2e/supabase-relay.mjs` — written *because* of that
exact measurement. Node can egress, so the relay lets Node do the talking and the
browser make ordinary loopback requests. `npm run e2e:relay` runs the whole suite
signed in against the real project. The note recorded the diagnosis and never got
updated when the cure shipped one directory away.

I read the note, ran `npx playwright test` with a hand-rolled config, got a blank
page, and reported the limitation as confirmed. Every step felt like verification.
None of it was: a blank page is *also* what the missing relay looks like, so the
observation could not distinguish the two, and I never asked what would tell them
apart. The section heading was the instruction, and I skipped past it to the
sentence underneath.

The same paragraph warns that `.env` is a template whose values live in the
process environment. I checked `.env`, saw empty passwords, and concluded the
credentials were absent. They were in `printenv` the whole time. A caveat can be
sitting in front of you and still not be applied, because reading a warning and
running the check are different acts.

**Lesson:** a documented limitation is a claim with a timestamp. Before repeating
one, look for the workaround — it is often committed next to the note, by whoever
hit the wall first. And prefer the positive test: "does `e2e:relay` work" is
answerable, where "is this environment limited" only ever confirms itself.

**Corollary for the note-writer:** when you work around a limitation, go back and
edit the sentence that describes it. Leaving "X is impossible" next to a script
that does X costs the next person the whole investigation again.
