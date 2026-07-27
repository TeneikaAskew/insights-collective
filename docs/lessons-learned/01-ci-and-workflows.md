# CI and workflows

## The headline bug: a reporter override hid every failure for months

The E2E job ran:

```
npx playwright test --reporter=list,html,json
```

A CLI `--reporter` **replaces the config's reporter array wholesale**. The JSON
reporter, given no resolvable `outputFile`, falls back to
`console.log(JSON.stringify(report, null, 2))` — confirmed in
`node_modules/playwright/lib/reporters/{json,base}.js`, not assumed.

Three consequences, none obvious in isolation:

1. the job log became ~500KB of pretty-printed JSON, so GitHub's log API — which
   returns only the **tail** — returned the report and nothing else
2. `test-results.json` and `test-results/junit.xml` were never written, so the
   failure-artifact upload silently collected neither
3. the `Coverage gap report` step's `[ -f test-results.json ]` guard was never
   true, making that step a **silent no-op for its entire existence**

The visible symptom was "23 failures and no way to learn which". The cause was
a one-line flag. `playwright.config.ts` already declared
`html+json+junit+github+list` with real output paths; the override was pure loss.

**Lesson:** when a CLI flag and a config file express the same thing, know which
wins. "Override" usually means *replace*, not *merge*.

**Lesson:** a diagnostics gap is sometimes a real bug wearing a disguise. Before
concluding "the tooling can't tell me", check whether something is preventing it
from telling you.

## Design steps so failures stay diagnosable

The log API returns the tail. Anything you need to read must therefore be
**emitted late and be small**. The coverage-gap step was extended to enumerate
failed/flaky tests (file, project, title, first error line, ANSI stripped) and
piped through `tee` rather than redirected — redirecting to
`$GITHUB_STEP_SUMMARY` alone keeps it *out* of the log entirely.

```
Passed: 549 Failed: 17 Skipped: 37 Flaky: 5

Failed tests (17):
 - visual/visual-regression.spec.ts [visual] blog-index @ /blog [public] — ...
```

That single change turned an undiagnosable red check into an attributable list,
and immediately exposed a blocker that had been mistaken for a footnote.

## A malformed input must never be worse than a missing one

An optional step:

```yaml
- name: Seed E2E fixtures
  if: env.SUPABASE_DB_URL != ''
  run: psql "$SUPABASE_DB_URL" -f e2e/fixtures/seed.sql
```

When the secret was first added with a bad value, psql treated it as a bare
database *name* and dialled the local unix socket. Under `bash -e` that killed
the job **before a single test ran** — no report, no artifacts. A mistyped
secret was strictly worse than an absent one, which is the wrong failure mode
for a step that is opt-in by design.

Fixed by validating the shape first, never letting a seeding problem take the
suite down, and raising a titled annotation on both failure paths. Also added
`ON_ERROR_STOP=1` so a mid-script SQL error is reported instead of psql exiting
0 having skipped statements.

**Lesson:** for every optional input, ask what happens when it is present but
wrong. That path is usually untested and often worse than absent.

## Attribute failures before acting on them

With 29 failures, the useful question is not "how do I fix 29 things" but "how
many are mine". Method used:

1. run the same suite on the **base branch** and diff the failure sets
2. for anything remaining, check whether the diff touches those areas at all

That produced: 11 mine (unapplied migrations), 1 mine (my own spec bug), 10
baselines (9 reproduce on `main`), 7 in areas the diff never touches.

Where proof was not available, it was labelled as such — `main` could not
enumerate its own failures until it inherited the reporter fix, so the 7 were
reported as *strong circumstantial evidence*, not proven.

**Lesson:** "it fails on main too" is the one legitimate not-mine outcome, and
it still requires evidence and a visible statement — never silence.

## GitHub Actions specifics worth remembering

- **A push made with `GITHUB_TOKEN` does not trigger further workflow runs.**
  The bot's baseline commit landed and the PR showed *zero* checks. Deliberate
  loop prevention; you need your own push (or a dispatch) to re-trigger.
- **`inputs.x` is null for non-dispatch events**, so `if: inputs.x != true` is a
  safe default-on guard and `if: inputs.x == true` a safe default-off one.
- **Adding `permissions:` to a job restricts the token to exactly that list.**
  Grant `contents: write` only where a step genuinely pushes.
- **A workflow can commit back to its own branch**, which is the only practical
  way to produce runner-generated artifacts (screenshots) that must live in the
  repo. Scope `git add` narrowly so nothing unexpected rides along.
