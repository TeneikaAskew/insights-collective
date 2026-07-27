# Lessons learned — admin remediation + blog consolidation

Written from a single long working session (PR #28) that spanned an eight-phase
blog consolidation, an admin redesign, eight production migrations, and roughly
a dozen CI round-trips. It is deliberately unflattering where that is accurate:
the most useful entries are the mistakes, because each one has a cheap
preventive check that was skipped.

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

## The one-paragraph version

Nearly every error in this session came from asserting something about a tool,
a file, or an artifact without spending the ten seconds it would have taken to
check. A CI round-trip costs ~13 minutes; reproducing the same mechanism
locally in an isolated harness costs seconds. The habit worth building is not
"be more careful" — it is **build the smallest possible local reproduction of
the mechanism you are about to depend on, before you depend on it.**
