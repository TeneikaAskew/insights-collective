# Memory: lessons from the query-validity audit

These notes come from one long piece of work on this repo — an audit that started
as "run the e2e specs" and ended up finding that five column mismatches, six
broken embeds and a platform-wide quiz outage had shipped while 893 unit tests
and 99 e2e specs stayed green.

They are written to be lifted into `CLAUDE.md` or used as-is. Each file is
self-contained.

| File | What it covers |
|---|---|
| [01-failure-modes.md](01-failure-modes.md) | The bug shapes this codebase actually produces, and why the tests missed them |
| [02-verification.md](02-verification.md) | How to know a change works, and the ways I fooled myself |
| [03-process.md](03-process.md) | Skipped steps that cost the most time, and the order that avoids them |
| [04-design-and-refactor.md](04-design-and-refactor.md) | Deleting, replacing and redesigning without losing capability |
| [05-corrections.md](05-corrections.md) | Where the user redirected me, and what the correction was worth |
| [06-repo-specifics.md](06-repo-specifics.md) | Facts about this stack that are expensive to rediscover |

## The one-paragraph version

Almost every defect had the same shape: **something reported success while doing
nothing.** PostgREST answers 200/204 when RLS filters every row; a rejected query
renders as an empty list; a mocked client accepts a function that does not exist;
a test guarded by `if (await x.count() > 0)` passes when the element is absent.
The fix is never more logging — the errors were already logged. It is to make the
silence impossible: assert on structured data, count affected rows, check names
against the real catalogue, and never let a test's assertion live inside a
condition that the failure itself turns off.
