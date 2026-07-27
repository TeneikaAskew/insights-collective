# Codebase gotchas discovered the hard way

Concrete facts about this repo, each one found by hitting it. Verified against
the live project at the time of writing; re-check before relying on any of them.

---

## Assignments only reach the SpeedGrader through a content item

`src/pages/InstructorAssignments.tsx:163` gates the "Grade submissions" link on
`content_item_id`. With it null, the page renders a **disabled** "No submissions
target" button instead. `CanvasGradingInterface` resolves the route parameter as
a **content-item id** (`const { courseId, contentItemId } = useParams()`), not
an assignment id.

**Consequence for fixtures:** an assignment row alone is not enough to make the
grading UI reachable. It needs a `content_items` row of type `assignment`, and
`assignments.content_item_id` pointing at it. Both must be published.

---

## Schema constraints that bite seed scripts

| table | constraint | what happens if you ignore it |
|---|---|---|
| `content_items` | unique `(module_id, position)` | A hardcoded `position` collides with existing items. Compute `max(position)+1` for the module. |
| `assignment_submissions` | unique `unique_user_assignment_attempt (assignment_id, user_id, attempt)` | `ON CONFLICT DO NOTHING` silently leaves a previously-graded row graded, so an "idempotent" seed stops supplying the ungraded fixture it advertises. |

For the second: reset the grading fields explicitly on conflict
(`workflow_state`, `grade`, `score`, `graded_at`, `grader_comments`,
`rubric_scores`, `excused`, `missing`). Verify by forcing the row to `graded`,
re-running the seed, and confirming it returns to `submitted`.

---

## `auth.users` is not reachable over PostgREST

The Supabase client exposes the `public` schema. `admin.from('auth.users')`
cannot work regardless of the key used — service_role included.

This is currently a live bug in `e2e/global-teardown.ts:60`:

```ts
const { data } = await admin.from('profiles').select('id').in(
  'id',
  await admin.from('auth.users' as any).select('id').in('email', emails)
    .then((r: any) => (r.data || []).map((u: any) => u.id)),
);
```

The inner query errors, `.data` is null, `|| []` swallows it, `.in('id', [])`
matches nothing, so `getTestUserIds()` always returns `[]` and every scoped
delete hits zero rows. It **fails safe** — nothing is deleted, real user data was
never at risk — but the teardown has never actually cleaned anything.

Compounding it: `SUPABASE_SERVICE_ROLE_KEY` is not in the `e2e.yml` job env at
all, so the DB teardown could not run in CI even with
`E2E_ENABLE_DB_TEARDOWN=true`.

**To resolve a user by email over the API,** use the Auth Admin endpoint
(`GET /auth/v1/admin/users`) with the service-role key. `public.profiles` has
only `id` — no email column — so it cannot be used for the lookup.

---

## The E2E suite runs against the shared production database

This explains several otherwise-baffling behaviours:

- **Test data accumulates forever.** The E2E member had 54 notifications, 34 of
  them textually identical, from repeated grading runs. Nothing cleans up (see
  the dead teardown above).
- **Visual-regression baselines drift on their own.** Specs that screenshot
  data-driven pages (`admin-courses`, `enrolled-courses`, `notifications`) change
  whenever the data changes, independent of any code change.
- **Assertions must tolerate concurrent writes.** The suite is fully parallel and
  several journeys mutate the same member's rows. Aggregate counts are unsafe;
  identify rows by primary key.
- **Never `--update-snapshots` to clear failures.** That bakes in current
  rendering and discards whatever the baseline was protecting. Visual diffs need
  a human looking at the images.

The durable fixes — a separate Supabase project for E2E, or masking dynamic
regions in screenshots — are design decisions for the repo owner, not something
to apply unilaterally.

---

## Seeding and teardown are both opt-in, and were both off

- **Seeding** is gated on `if: env.SUPABASE_DB_URL != ''`. While that secret was
  unset the whole step was skipped, which is why the E2E member had no
  certificate even though `seed.sql` has always seeded one — and why
  `profile-certificates-flow` failed.
- **Teardown** is gated on `E2E_ENABLE_DB_TEARDOWN=true` plus
  `E2E_ALLOW_TEARDOWN_TARGET` matching `VITE_SUPABASE_PROJECT_ID`.

The intended cycle is *seed before → test → teardown after*. With neither half
running you get both drift and accumulation. Note that enabling destructive
teardown against the production project is exactly what its fourth safety gate
exists to discourage.

---

## A grade-pinning trigger blocks direct `grade` writes

Setting `grade` via a plain `UPDATE` on `assignment_submissions` silently leaves
it null while `workflow_state` still changes — there is a trigger pinning the
grade columns to authorised paths. Worth knowing when a seed or manual fixup
appears to half-apply.
