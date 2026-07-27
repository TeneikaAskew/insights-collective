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

## Deletion

- **Prove replacement before deleting.** Gate removal behind a written parity
  checklist with evidence per capability. *(Used here; it caught two identically
  named components where the wrong one was nearly deleted.)*
- **A green test suite does not validate a merge conflict resolution** when
  nothing renders the component in question. Resolve conflicts by reading both
  sides' intent, then verify with a targeted search
  (`rg -n "AdminGuard" src` → must return nothing).
