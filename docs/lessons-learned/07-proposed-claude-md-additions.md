# Proposed CLAUDE.md additions

Distilled from `00`–`06`. Each rule traces to a concrete failure or near-miss in
this repository, cited so it can be judged rather than taken on faith. Drop in
what earns its place; the supporting files hold the evidence.

---

## Verify before you depend

- **Reproduce a mechanism locally before depending on it in CI.** A CI
  round-trip is ~13 minutes; an isolated local check is seconds. Use a throwaway
  config or synthetic fixture so the check cannot cause side effects.
  *(A CLI flag's arity was assumed and cost a full round-trip.)*
- **Check a tool's actual definition, not its remembered behaviour** — `grep`
  the CLI declaration, read the reporter source, read the teardown. Assumptions
  about arity, output destination, and file lifecycle were all wrong here.
- **Before asserting on a file, know what else writes or deletes it, and when.**
  A guard checked session files that teardown had already removed, and reported
  "not authenticated" for sessions that were fine.
- **Before interpreting an artifact, check its properties.** A screenshot was
  read as showing an empty section; it was a viewport-height capture of an
  inner-scrolling page.
- **Ask whether an assertion could pass for the wrong reason.** Prefer an order
  *flip* over a single ordering; prefer a discriminating selector over a
  convenient one.
- **Before running a diagnostic, ask what each outcome would prove.** If failure
  would be uninformative, say so instead of running it.
- **Suspect your own tooling first when it reports something surprising.** A
  diagnostic that produces false defects is worse than none, because it spends
  attention on nothing. *(Unbounded lookahead, whitespace handling, commented-out
  code and no-arg RPC probes each produced confident wrong answers here.)*
- **Do not add to a thing you just measured.** An untested "safety" clause
  appended to a verified `--host-resolver-rules` string made Chromium discard the
  whole rule, silently undoing the fix.
- **Read the environment's own documentation before the third attempt.** An hour
  went into proxy configurations that `/root/.ccr/README.md` already described.
- **Green is not evidence.** After any infrastructure change, assert that data
  *arrived* — a request count, a quoted seeded string — rather than the absence
  of failure. Three suites went green against an app with no data at all.
- **Confirm the check's scope covers what you changed.** `tsc --noEmit` passed
  on a file it does not compile (`e2e/**` is outside the tsconfig) while that
  file had a syntax error. A green check says nothing about code it never read.
- **Verify the tree you are measuring.** When a metric moves with no cause,
  suspect the inputs before the subject. A worker restart silently rolled the
  clone back hours; the only symptom was a test count that did not match memory.
- **Scripted edits need more review than hand edits, not less.** A hand edit is
  reviewed as it is typed. A codemod is not reviewed at all until something
  reads the result — lint and parse the files the *script* touched, not the ones
  you touched.

## Don't make things worse to make them green

- **Never weaken a check to clear it.** Not `--exclude-detectors`, not
  downgrading a real console error, not granting broad read access to fix a
  cosmetic defect. Green obtained that way is a lie that outlives you.
- **Never fabricate a number.** A failed query renders `—`, never `0`. No
  hardcoded deltas, no placeholder metrics.
- **Never commit a generated artifact captured from a broken state.** Regenerate
  visual baselines only after the data layer is correct, and gate the commit on
  proof that every role authenticated.
- **For every optional input, handle "present but wrong".** A malformed secret
  must never be worse than an absent one; that path is usually untested.

## Gates, checks and instruments

- **Every count a tool reports needs a way to say "I could not tell."** A gate
  returning zero because it failed to parse its input looks exactly like a clean
  result. *(A CodeQL summariser printed `security findings (0)` while the check
  reported 2 high — it had read the wrong SARIF field and resolved no rules at
  all.)*
- **Being able to produce output is not being able to read it.** Put the
  conclusion where the reader's window lands — for a log API that returns the
  tail of a job, that means last. Sorting most-severe-first buried the only
  lines that mattered.
- **A rule that fires on ordinary data is a rule someone switches off.** The
  worth of a structural check is that everything it reports is a defect *by
  definition*. One false positive per run gets it disabled, taking its real
  coverage with it. *(A read-only RPC returning no rows was flagged as a write
  that changed nothing.)*
- **When a rule over-matches a legitimate pattern, exempt the instance with its
  reason** — not the blanket marker used for genuine debt. A reader has to be
  able to tell which exemptions are backlog and which are by design.
- **Gate the siblings, not just the one in front of you.** When you make one
  thing conditional, find everything implementing the same policy by another
  mechanism and make it conditional too. *(Chromium's hermetic block was gated
  on relay mode; the Firefox equivalent was not, and 17 CI specs ran against an
  app whose every request died.)*
- **Point the gate at what the code actually uses.** A types-drift check
  validated a generated file while the client typed every query from a
  different, hand-written one. Two declarations of one schema is the defect —
  delete one rather than teaching the gate to read both.
- **When two fixes make the signal worse, the framing is wrong.** Stop refining
  and re-examine the category. *(Host matching was attacked twice as a regex
  problem, doubling the alert count, before being solved as host comparison.)*
- **A check that cannot fail for the right reason is not a check.** Six visual
  baselines over live shared data failed at 11–51% of pixels across six runs
  even with masks and widened tolerance. Regenerating would bake in one
  arbitrary moment; permanent red trains everyone to ignore the job. Narrow the
  check to what it can actually measure.

## Database and migrations

- **A new database object is part of the diff, not a deployment detail.** If
  code calls an RPC that does not exist yet, the feature is broken — track it as
  a blocker and state what breaks.
- **Confirm a migration's version is unused in the target.** Duplicates are
  silently skipped; a security fix can appear shipped and never run.
- **Verify the effect with a query, not the tool's success flag.** Impersonate
  the role (`SET LOCAL ROLE anon`) rather than reasoning about policy.
- **Aggregate server-side.** Client-side tallies over `select()` are silently
  truncated at the PostgREST row cap and produce wrong numbers that look real.
- **`SECURITY DEFINER` needs a pinned `search_path` and its own authorization
  check.** Prefer `INVOKER` when RLS already expresses the rule.
- **A 2xx write is not a write.** PostgREST answers 200/204 when RLS filtered
  every row, so `if (error)` passes and the UI reports success for something
  that never happened. Send `Prefer: count=exact` and check the count — measured
  at +0.3ms on a 68ms round trip, because it comes from the same statement.
- **Know which PostgREST codes are defects by definition.** `42703`, `42P01`,
  `22P02`, `PGRST200`, `PGRST204`, `PGRST202` mean the code asked for something
  that does not exist and can never be "expected in this environment".
  `PGRST116` and 401/403 are data and permission conditions — treating them the
  same is how a check earns its way into the ignore list.
- **Only the database can validate a query.** `types.ts` drifts;
  `npm run audit` replays every shape against the live project and is the
  authority.

## Design and refactor

- **Find the existing pattern before inventing one.** Two ways to persist the
  same settings in one feature is a defect waiting to happen. *(The new course
  Settings view merges into the `courses.settings` jsonb exactly as the
  certificates and design views already did.)*
- **Ship less, honestly, rather than more, falsely.** A control that cannot yet
  do what it says is worse than a missing one, because it reads as a promise.
  Ship only what has a real consumer, or label it as not-yet-wired.
- **Default a new flag to the existing behaviour.** `enabled !== false`, not
  `enabled === true` — the difference is whether every existing row silently
  loses a feature on deploy.
- **Derive a rule from its policy instead of enumerating cases.** An allow-list
  that is the exact complement of what you blocked cannot drift; a list of hosts
  to suppress goes stale the moment someone adds a font.
- **Put a pass/fail rule where a unit test can reach it.** A predicate living
  inside a Playwright fixture cannot be tested, and its negative cases are the
  ones that matter — a rule nothing can test is how the last set of suppressions
  drifted into hiding real defects.
- **Narrow a security rule; do not remove it.** Allow plain HTTP for loopback
  only; add only the configured origin to `connect-src`. Then test the
  rejections (`http://127.0.0.1.evil.com` must still fail), not just the
  acceptances.
- **Fix order dependencies, not just items.** If you are about to remove a
  workaround, find what it was working around first — otherwise you recreate the
  symptom.
- **Let the tooling own process lifecycle.** Playwright's `webServer` with
  `reuseExistingServer` replaced several rounds of hand-rolled start/kill, one
  of which killed its own shell.

## Secrets

- **Never write a credential-shaped placeholder**, even in a comment. Describe
  the parts in prose. Scanners match the shape, and clearing a flagged commit
  requires history rewriting.
- **If a live credential appears in conversation: say so, recommend rotation, do
  not persist it, do not echo it back.** Diagnose structurally without
  transmitting it.

## Tests

- **A spec's location determines its role** in a path-routed Playwright config.
  Confirm which project claims a new file before writing assertions.
- **A regex alternation in a locator can match several elements** — strict mode
  then fails with a message that reads like absence.
- **Prefer a skipped-and-explained test to a flaky one**, with a comment saying
  why it lives where it does.
- **Review generated artifacts by eye.** A green guard and plausible byte counts
  are not review — reading a regenerated screenshot is the only reason a real
  user-facing defect was found here.
- **Never put an assertion inside a condition the failure switches off.**
  `if (await x.count() > 0) { expect(…) }` passes whether the feature works or
  is absent. Assert the expected state, or seed the data and assert
  unconditionally. Banned by `no-restricted-syntax` in `eslint.config.js`.
- **A mock must reject what the real thing rejects.** `rpc: vi.fn()` accepting
  any string is how 893 tests stayed green against a function that never
  existed.
- **No third party may decide whether the suite passes.** `page.goto` waits for
  `load`, so one slow CDN gates every navigation. Keep the browser hermetic —
  but not in CI, where blocking fonts and images changes what every page renders
  and invalidates every visual baseline.
- **Landing a rule against an existing backlog:** ship the rule, mark the
  existing violations with a one-time disable and a greppable TODO. Failing lint
  everywhere gets the rule reverted; excluding the directory hides the debt.

## Reporting

- **Separate proven from probable, and label which is which.** One sentence of
  epistemic honesty is the difference between a report someone can act on and
  one they must re-verify.
- **State environment limits explicitly** — which specs actually ran, what could
  not be checked here and why. Silence implies coverage that does not exist.
- **Report the consequence, not just the fact.** "Migrations pending" reads as
  boilerplate; "these three admin pages cannot load their data" does not.
- **Treat bot and agent output as leads, not findings.** Verify against the live
  system before acting.
- **Correct errors plainly and continue** — the correction and its evidence, no
  apology, no post-mortem.
- **Say when you were guessing, and correct it unprompted when the answer
  arrives.** "Probably SSRF in the relay" turned out to name a rule that appeared
  nowhere in the results. One paragraph to retract; otherwise someone hunts a
  vulnerability that was never reported.
- **Trace statically when you cannot reproduce — and say that is what you did.**
  Name the evidence the trace rests on and what the next step is if it is wrong,
  so a reader can tell a trace from a guess.
- **A hypothesis that explains the data is not a diagnosis.** Before naming a
  cause, find the control that would distinguish it from the alternatives —
  another branch's run in the same window, or a re-run of unchanged code. Both
  are usually free. *(I attributed intermittent auth failures to rate limiting
  from my own CI load; main passed in the same window and a docs-only commit
  went from 6 failures to 2, disproving it twice over.)*
- **Re-run unchanged code to tell flake from defect** — before theorising, not
  after. It is the cheapest experiment available and it settles the question
  that all the theorising is about.

## Consent

- **Act freely on:** reversible, branch-scoped work; fixing your own bugs;
  read-only verification.
- **Confirm first for:** production database changes, force-pushes, merging past
  a red check, anything that rewrites published history or alters attribution of
  someone else's work.
- **When blocked by a permission guard, explain rather than route around it** —
  what was attempted, why alternatives genuinely fail, and the measured blast
  radius. Specifics let the user decide in seconds; "this is risky" does not.
- **Finding a real problem does not mean fixing it now.** State it, size it, and
  make scope a deliberate choice.
- **Resolve merge conflicts toward the better version, not your own.** When two
  branches fix one defect independently, read both sides' intent and keep the
  better one — or the union where they are independent. Authorship is not a
  tiebreaker. *(Theirs threw on a missing password where mine fell back to a
  hardcoded one.)*
- **Act on the current revision, not the one a stale reminder names.** Scheduled
  check-ins and webhook events arrive late and reference superseded commits;
  re-check what HEAD is before re-doing finished work.
- **Prefer the read-only proof.** To show a monitor can fire, run its predicate
  against a masked copy rather than deleting a row inside a transaction you
  intend to roll back. If the only proof you can think of is destructive, think
  again.
- **Ask for the least authority that works.** "I can't get at X" usually
  decomposes into *can't reach* and *can't read*; reaching for the more powerful
  credential is the expensive way to avoid asking which one you have. *(The
  audit needed no management token — `authenticated` already reads `pg_proc`.)*

## Deletion

- **Prove replacement before deleting.** Gate removal behind a written parity
  checklist with evidence per capability. *(Used here; it caught two identically
  named components where the wrong one was nearly deleted.)*
- **A green test suite does not validate a merge conflict resolution** when
  nothing renders the component in question. Resolve conflicts by reading both
  sides' intent, then verify with a targeted search
  (`rg -n "AdminGuard" src` → must return nothing).
- **Unreferenced is not the same as removed.** A reachability check says what
  *runs*, not whether a *capability* survived. Enumerate the actions a file
  offers and confirm each one landed somewhere. *(A dead settings form held the
  only working delete-course in the app; its save was a `setTimeout` and a fake
  toast, and the delete was real.)*
