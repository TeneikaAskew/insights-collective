# Lessons learned — admin remediation, blog consolidation, featured courses

Written from two long working sessions: PR #28 (an eight-phase blog
consolidation, an admin redesign, eight production migrations, roughly a dozen
CI round-trips) and PR #32 (the landing page's Featured Courses section and the
automated-review round that followed). It is deliberately unflattering where
that is accurate: the most useful entries are the mistakes, because each one has
a cheap preventive check that was skipped.

Files `00`–`07` come from the first session, `08` from the second. They fail in
different ways and that difference is the point: the first session's mistakes
were about **tools** — a CLI flag's arity, a file's lifecycle, an image's
dimensions. The second session's headline mistake was about **evidence** —
verifying at length that a fix worked, without ever verifying that the thing it
fixed was broken. Careful verification aimed at the wrong proposition still
produces a confident, wrong claim.

## How to use this

`07-proposed-claude-md-additions.md` is the distilled output — rules phrased for
dropping into `CLAUDE.md`. Everything else is the evidence behind those rules,
so a reader can judge whether a rule earns its place rather than taking it on
faith.

| File | Theme |
|---|---|
| `00-verification-discipline.md` | The single root cause behind most mistakes here |
| `01-ci-and-workflows.md` | GitHub Actions, log truncation, failure attribution |
| `02-testing-and-playwright.md` | Locators, projects, baselines, guards |
| `03-database-and-migrations.md` | Supabase versioning, RLS, code/schema coupling |
| `04-secrets-and-credentials.md` | Scanning false positives, pasted credentials |
| `05-authorization-and-consent.md` | What to do without asking, what never to |
| `06-honest-reporting.md` | Claiming only what was proven |
| `07-proposed-claude-md-additions.md` | **The distilled rules** |
| `08-premise-and-attribution.md` | Verifying the *bug*, not just the fix (PR #32) |

## The one-paragraph version

Nearly every error in these sessions came from asserting something — about a
tool, a file, an artifact, or the state of a bug — without spending the ten
seconds it would have taken to check. A CI round-trip costs ~13 minutes;
reproducing the same mechanism locally in an isolated harness costs seconds. Two
habits are worth building. **Build the smallest possible local reproduction of
the mechanism you are about to depend on, before you depend on it.** And
**check that the problem exists before proving you solved it** — search for what
already covers the route, role or behaviour you are calling broken, because a
green test that contradicts your reasoning is evidence, and evidence outranks
inference.
