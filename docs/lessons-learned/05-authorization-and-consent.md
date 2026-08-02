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

## A write that matches zero rows is not a working feature

Marking a thread read was a plain table write:

```
update messages set read = true
where conversation_id = $1 and sender_id <> me and read = false
```

The only UPDATE policy on `messages` is `messages_update_own`
(`sender_id = auth.uid()`), so every row that statement wants is a row somebody
else sent. It matched nothing, every time, since the policy was written.
PostgREST answers that 204 with zero rows and no error, so nothing anywhere
looked broken — while received messages kept their unread styling forever.

It survived because "nothing left to mark" and "RLS filtered every row" are the
same response. The only way to tell them apart is to **assert the row count**,
which a fire-and-forget write never does. Simulating the policy under a real JWT
(`set local role authenticated` + `request.jwt.claims`, inside a transaction that
rolls back) showed `rows updated = 0` in one query.

The fix is a SECURITY DEFINER RPC that checks membership and *returns* the count,
not a wider policy: RLS cannot scope an UPDATE to a single column, so a policy
permissive enough to let a recipient set `read` also lets them rewrite the
sender's `content`.

**Lesson:** when a write's whole job is to change rows, the count is the result.
Discard it and a permanently no-op write is indistinguishable from success.

## RLS is not a control on a path that runs as the service role

Course messaging had an `open_course_thread` RPC enforcing exactly the right
rules — enrolled or teaching, students to instructors only, no duplicates. It was
never the only way in. `conversations` allowed INSERT on `created_by = auth.uid()`
and `conversation_participants` allowed adding *any* user id to a conversation you
created, so any account could open a thread with any other account. Removing those
policies closed the client path.

It did not close the real one. `messages-helper` runs every query with the service
role key, and the service role bypasses RLS entirely, so `createConversation` kept
working regardless of any policy. Deleting it from the function's source is not a
control either: Edge Functions in this repo are deployed by hand, with no CI step,
so source-only removal means the old code is still serving traffic.

Triggers are the control. `BEFORE INSERT` fires for every writer, service role
included. Probed as the service role, both halves are refused: a conversation with
no `course_id`, and a participant who is not in that course.

**Lesson:** ask which layer a bypass runs at before choosing where to enforce. If
any writer runs as the service role, RLS is advice; a trigger or a constraint is
the rule.
