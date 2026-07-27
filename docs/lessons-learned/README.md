# Lessons learned

Files 00–07 come from one long working session (PR #28) spanning an eight-phase
blog consolidation, an admin redesign, eight production migrations, and roughly
a dozen CI round-trips. Files 08–12 come from a second session — the
query-validity audit — and are kept separate because their failures have a
distinct shape: not mistakes made while building, but defects that had been live
for months without anything noticing.

File 12 is a category of its own and worth reading first if you only read one:
defects in the *instruments* rather than the product. Every entry in it is a
gate, reader or harness failing in exactly the way it was built to prevent.

Both sets are deliberately unflattering where that is accurate: the most useful
entries are the mistakes, because each one has a cheap preventive check that was
skipped.

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
| `08-silent-failures-and-the-query-audit.md` | Successes that did nothing, and the gate that catches them |
| `09-corrections-and-process.md` | Where pushback changed the outcome, and the order that mattered |
| `10-design-refactor-deletion.md` | Choosing what to build, narrow, and remove |
| `11-repo-and-stack-specifics.md` | Verified stack facts worth not rediscovering |
| `12-when-the-tooling-lies.md` | Gates and readers failing the way they were built to prevent |

## The one-paragraph version

Nearly every error in this session came from asserting something about a tool,
a file, or an artifact without spending the ten seconds it would have taken to
check. A CI round-trip costs ~13 minutes; reproducing the same mechanism
locally in an isolated harness costs seconds. The habit worth building is not
"be more careful" — it is **build the smallest possible local reproduction of
the mechanism you are about to depend on, before you depend on it.**
