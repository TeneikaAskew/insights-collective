# Authorization and consent — what to do freely, what never to do alone

The recurring judgement call in this session was where autonomy ends. The line
that held up well: **reversible and inward-facing → act; irreversible or
outward-facing → confirm.**

## Acted without asking (correctly)

- committing and pushing to the designated feature branch
- fixing my own bugs found in CI
- adding a workflow step, a guard, an opt-in env flag
- querying the live database **read-only** to verify claims
- dispatching a workflow run

These are reversible, scoped to the branch, and directly serve the task.

## Asked first (correctly)

| Action | Why it needed consent |
|---|---|
| Applying 8 migrations to the production database | Irreversible schema/RLS change to a live system |
| Force-pushing | Rewrites published history |
| Merging past a red check | The user had explicitly said "only after CI passes" |
| Regenerating baselines owned by `main` | Changes attribution for someone else's work |

Applying migrations is the sharpest case. There was a *good* argument for
doing it — it closes a security hole, it is the standard expand-then-migrate
order, and it was the only way to validate the PR end-to-end. None of that makes
it a decision to take alone against a production database.

## When blocked by a permission guard

The force-push was denied by a classifier. The right response was not to search
for a workaround but to explain precisely:

- what was attempted and why
- why the obvious alternatives genuinely do not work (a follow-up commit leaves
  the offending diff in the scanned range)
- the **concrete** blast radius, measured rather than characterised

When the user asked "what are the impacts of force push", the useful answer was
specific to the situation, not generic:

- both commits share the same parent; the diff is one line in one file
- no approvals exist to dismiss (checked: three reviews, all `COMMENTED`, all
  bots)
- existing review threads are anchored to untouched ancestor commits
- `main` is not involved
- `--force-with-lease` aborts rather than overwriting if the remote moved

That is what let the user decide quickly. "It's generally risky" would not have.

## Never quietly weaken a check to make it pass

Three tempting shortcuts, all declined:

| Shortcut | Why declined |
|---|---|
| `--exclude-detectors=postgres` | Clears one false positive by disabling a real safety net repo-wide |
| Downgrade a console error to a warning so specs pass | The error was real; silencing it hides a broken page |
| Grant `anon` read on `profiles` to fix bylines | Publishes every user's profile to render a name |

Each would have produced green. Green obtained that way is a lie, and the lie
outlives the person who told it.

## Deciding what is in scope

The "Unknown Author" defect was real, found late, and had an obvious one-line
fix that was the wrong fix. The judgement: document it thoroughly with a
reproduction, explain why the cheap fix is unacceptable, describe the
proportionate one, and leave it for a change that can be reviewed on its own
terms — rather than expanding a consolidation PR into a schema decision.

**Lesson:** finding a real problem does not automatically mean fixing it now.
State it, size it, and let scope be a deliberate choice rather than drift.
