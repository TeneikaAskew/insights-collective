# Gradebook real-role fixture: instructor to learner, 10-point assignments (PREPARED, NOT EXECUTED)

This is for #139 (`claude/gradebook-points-readback`). It runs only on a local or isolated Supabase stack, through `run.sh`, after the loopback target guard. It needs review before execution.

## Scope
| Id | Who | What | Expected |
|---|---|---|---|
| W1 | instructor, SpeedGrader | SG0: grade 0 with feedback | PATCH 200, 1 row: grade 0, `graded`, the feedback. After reload: 0 in the input, the feedback, Graded (1) |
| W1b | instructor, SpeedGrader | SG0 again: **same grade 0**, new feedback | PATCH 200, 1 row with the new feedback. After reload: the new feedback. Audit `grade_changed` 0 to 0 with `comments_changed=true` |
| W2 | instructor, SpeedGrader | SG7: grade 7 with feedback | as W1, with 7 |
| W3 | instructor, course gradebook | GB0 = 0, GB7 = 7 | each PATCH 200, 1 row, `graded`. After reload: cells show `0/10` and `7/10`, never `/100`. CSV: earned 0/7/0/7, possible 10, status `graded` |
| Z1 | instructor, API | PATCH a submission in a course they do not teach (GX) | 200 with `[]` (**zero-row**); the row is unchanged in the witness |
| L-* | learner | open each assignment twice (fresh loads) | `Score 0 / 10` or `Score 7 / 10`, the feedback where given, never `/ 100` |
| L-list | learner | assignments list | `0/10 pts` and `7/10 pts`, no `/100 pts` |
| P1 | learner, API | PATCH own SG7 `{grade:10, grader_comments}` | 200, 1 row, grade 7 and feedback unchanged (**pinned**: `pin_assignment_grade_columns`). No audit event |
| Z2 | learner, API | PATCH another user's submission | 200 with `[]` (**zero-row**) |

The fixture's `score` is NULL throughout, so what the learner sees comes from `grade` (the #139 contract). Screenshots are real `page.screenshot` attachments: W1, W1b, W2, W3, the four L-* cases, and L-list. The CSV is attached as downloaded.

## Files
- **`seed.sql`** creates:
  - course GB, taught by e2e-instructor, with four 10-point assignments and one SUBMITTED, ungraded e2e-member submission each;
  - course GX, taught by e2e-admin only, with one assignment holding a member row (311) and an admin row (312).

  It inserts only, with fixed ids. It REFUSES unless all 6 submissions are pristine, all 5 assignments have `points = 10`, and the instructor teaches GB but not GX. So a second run on a used stack fails instead of grading on top of earlier results.
- **`witness.sql`** is read-only. It records:
  - the exact state of every fixture submission (feedback only as md5);
  - the audit trail (`submission_audit_events`) for those submissions;
  - full-row hashes of everything protected: other submissions, other audit events, `grades`, `grade_history`, `certificates`, and the fixture assignments;
  - member notifications as a count, observed only.
- **`expected-post.txt`** is the exact expected post-run state and audit trail. The SpeedGrader feedback md5 is resolved only after checking that the stored HTML contains the typed text.
- **`run.sh`** runs these steps in order:
  1. guards;
  2. seed;
  3. pre-witness, refusing if the protected set is empty;
  4. Playwright (`playwright.gradebook-roles.config.ts`: `gb-instructor`, then `gb-learner`; `retries: 0`, 1 worker);
  5. post-witness;
  6. exact diff, plus a protected-hash diff.
- **`e2e/gradebook-roles/`** holds the two specs and the helper. API probes reuse the page's own session against the loopback API only, with `maxRedirects: 0`.
- **`sql-rehearsal.sql`** is the LOCAL SQL rehearsal described below.

## What was run here (LOCAL SQL only: plain PG16 from `ic_base` plus `local-preseed.sql`; no GoTrue, PostgREST or browser)
- **Seed:** applies, and a rerun on a pristine stack is a no-op.
- **Role-class rehearsal** (`sql-rehearsal.sql`, authenticated role with JWT claims, rolled back):
  - I on SG7 and GB0 returns 1 row with the new values;
  - I on GX returns **0 rows**;
  - M on own SG7 returns 1 row with grade and feedback **unchanged**;
  - M on the admin's row returns **0 rows**.

  The witness was identical after the rollback.
- **Full expected sequence** (as the real role ids, scratch DB): the post-state and audit trail match `expected-post.txt` exactly, and the protected hashes are identical.
- **Negative controls:**
  - a 7 to 8 change on GB7 is detected (the state line and an extra audit line);
  - seed refuses on the used stack ("2 of 6 fixture submissions are pristine").
- **Specs:** `playwright test --list` shows 12 tests in 2 projects. This used a local stand-in Firefox path, because the base config resolves Firefox at load. `tsc` reports no errors in the new files.

**None of this is API, browser or runtime evidence.**

## Final hardening batch (local only; supersedes older counts above where they differ)
- **Origin guard** (`e2e/gradebook-roles/origin-guard.mjs`, `guarded-test.ts`): every setup and test context aborts any request whose origin is not exactly the bound app or API origin BEFORE it is sent. Redirects are followed inside the route handler hop by hop, each hop judged before it is fetched; popups, frames, workers and WebSockets go through the same context route; service workers are blocked at context creation. Allowed requests return the real local response unchanged. Each test fails if anything was blocked.
- **App/API/DB association:** `run.sh` writes a fresh 128-bit nonce into the GB course row through the DB DSN; `session-setup.ts` must read exactly that value back through the approved API, and the app must have called that API. Loopback URLs alone are not taken as proof of one stack.
- **Composition** (`composition.sql`): detected from the database (pin_assignment_grade_columns md5 plus the `local_evidence.applied_migrations` ledger). `baseline-139` / `t09-old` use `expected-post.txt`; `composed-r5` uses `expected-post.composed-r5.txt`. Unknown or mismatched fails closed. `GB_COMPOSITION` is exported to the specs.
- **Witness:** immutable and enrollment hashes use `jsonb_build_array(...)` (NULL- and position-preserving; `concat_ws` skipped NULLs); all ids, actors and notification recipients are full UUIDs. `OBSERVED fixture_item_progressions` and `OBSERVED fixture_notifications_read` stay declared observe-only exclusions.
- **Rehearsal** (`tests/local-sql-rehearsal.sh`): a negative counts as detected only if the corruption and witness ran with psql exit 0, the witness is complete (6 STATE, all 12 HASH keys, NOTIF, both OBSERVED), and the comparison differs. Two contract controls (SQL error, unacquirable witness) must come out INVALID. Seed reuse must fail with the specific used-stack refusal.
- **U2** now sends the SAME grade 7 with changed feedback, so only a full-field readback rejects it.
- **P4** records OLD #139/c5 fixture-baseline behaviour only (workflow_state promotion passes). Under `composed-r5` (#136 r5, 20261101000600) the promotion is pinned and the spec expects `submitted`. No backend change here; it is not a policy proposal.

## Not done or not claimed
- **No execution** against any GoTrue, PostgREST or browser stack. Nothing was dispatched, and there are no production writes.
- **Not in any workflow.** Running it in CI needs a writable scope that does not exist yet. The `readonly-courses` scope is NOT broadened. The workflow addition is a separate proposal for review:
  - a `gradebook-roles` dispatch option and job, with the same local stack and guards;
  - `run.sh` in place of the read-only Playwright step.
- **No new policy, trigger or function.** P1 documents the existing pin and claims nothing more.
- **No stale-attempt or concurrency safety claim.** Writers update by id only; that item stays open.
- **Not addressed:** the null-points fallback of 100, divergence between `score` and `grade`, and the unused third writer (`assignmentService.gradeSubmission`).
- **Rejection UI is tested in SpeedGrader only** (U1 zero-row, U2 pinned). The course-gradebook writer's error path for a denied or pinned save is NOT exercised; its readback shares `assertGradeSaved`, which unit tests cover, but no browser case proves the gradebook cell shows the error.
- **Port binding:** the isolated stack's published ports bind all interfaces by default (see run 41317521050). Any execution inherits whatever is decided for that.
