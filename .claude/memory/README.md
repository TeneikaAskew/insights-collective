# Lessons learned — E2E stabilisation sessions

Written after a session that fixed CI failures in the Playwright suite, took an
automated review round, and got blocked on a database credential. Every entry
below is grounded in something that actually happened in that session, with the
file and line where it happened, so it can be checked rather than taken on
faith.

Roughly half of these are records of **my own mistakes**. That is deliberate:
generic advice ("be careful", "verify things") does not change behaviour, but a
specific memory of claiming a fix worked when it did not, and being caught by a
reviewer, does.

## Files

| file | what it covers |
|---|---|
| `01-verification-discipline.md` | The core failure mode: asserting a fix works without checking the path that would prove it. Where the reasoning was skipped and what it cost. |
| `02-codebase-gotchas.md` | Concrete facts about this repo discovered the hard way — schema constraints, render conditions, a dead teardown. |
| `03-ci-and-tooling.md` | How the CI tools here actually behave: TruffleHog's scan scope, psql's argument handling, Supabase connectivity from Actions. |
| `04-credential-handling.md` | What went wrong with secrets in this session and the rules that would have prevented it. |
| `05-proposed-claude-md-additions.md` | Ready-to-paste sections for `CLAUDE.md`. Start here if you only want the actionable output. |
| `06-ci-triage-and-silent-controls.md` | A later session: triaging five failures with three unrelated causes. Backend logs before backend theories; tests that passed by accident; controls that revert instead of reject; assertions that say what they saw. |

## How to use this

`05-proposed-claude-md-additions.md` is the one to read first — it is written as
drop-in `CLAUDE.md` prose. The other files are the evidence behind it; keep them
if you want the reasoning to survive, delete them if you only want the rules.

## The one-line version

Most of the wasted cycles in that session came from the same shape of error:
**acting on a plausible model of the system instead of checking the system.**
Every case where I read the actual code, ran the actual script, or queried the
actual database first produced a correct result. Every case where I reasoned
from what "should" be true produced a wrong claim that someone else had to
catch.
