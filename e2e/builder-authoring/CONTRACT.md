# Builder authoring acceptance: contract (source only, UNRUN)

Scope: course builder reorder (T-54), zero-row delete (T-54), resumable creation with actor binding (T-56), as
frozen on #165 at c364f71d. Real UI against a fresh local stack in the shared runner job; no mocks of the app's
network in the EXECUTABLE rows. Nothing here has run. No SQL, RLS or RPC change; no production seed.

## Controls

| Id | Control | Status | How it is proved | Viewports |
|----|---------|--------|------------------|-----------|
| BA-R1 | Section reorder (keyboard) is stored and shown after reload | EXECUTABLE | `reorder.spec.ts`: Space/ArrowDown/Space on "Reorder section"; REST read of `modules.position` equals the new order; reload shows it | 1440, 768, 390 |
| BA-R2 | Lesson reorder (pointer) is stored and shown after reload | EXECUTABLE | `reorder.spec.ts`: pointer drag on "Reorder lesson"; REST read of `content_items.position`; reload | 1440, 768, 390 |
| BA-D1 | Applied delete removes the lesson, stored and shown | EXECUTABLE | `delete.spec.ts`: "Lesson actions" then "Delete lesson"; REST read finds no row; reload | 1440 |
| BA-D2 | Zero-row delete is refused and the item stays | EXECUTABLE | `delete.spec.ts`: the row is removed out of band (real REST DELETE as the same instructor), then the UI delete returns 0 rows; the UI says "Lesson not deleted" and keeps the item until reload; after reload it is gone (the server state). No injection: the zero-row result is real | 1440 |
| BA-C1 | Scratch creation makes exactly one course owned by the signed-in instructor | EXECUTABLE | `create.spec.ts`: wizard "Start from scratch"; REST count of courses titled with the run nonce is 1, `instructor_id` is the e2e instructor, outline "Section 1" / "Introduction"; id recorded for the manifest | 1440, 768, 390 |
| BA-P1 | Injected reorder RPC failure rolls back to the last confirmed order | PENDING (no qualified injection) | needs a reviewed failure injection for `reorder_*` RPCs (see below). Author tier today: `reorderReconcile.test.ts`, `CourseBuilder.reorderDelete.test.tsx` | |
| BA-P2 | Overlapping reorders in the same mount: one in flight, last request decides | PENDING (needs held response) | same injection, used to hold the first response. Author tier: overlap cases in the same tests | |
| BA-P3 | Course switch while a reorder is pending keeps each course's target | PENDING (needs held response) | same injection plus navigation to course B. Author tier: target-binding cases | |
| BA-P4 | Interrupted create resumes to exactly one course | PENDING (needs a failed insert mid-plan) | injection on a `content_items` insert, then Retry; count stays 1. Author tier: `courseCreation.test.ts`, `CourseBuilder.wizardResume.test.tsx` | |
| BA-P5 | Changed-account or signed-out retry makes no writes | PENDING (needs a failed first attempt to leave a started plan) | same insert injection, then sign out or switch to e2e-member and Retry; REST shows no new rows. Author tier: A1 to A4, W5, W6 | |
| BA-L1 | Partial draft after reload | DISCLOSED LIMIT, not a pass | the plan is in memory only; a reload after a partial create leaves the partial draft course and a new attempt starts a second course. This is stated behaviour, not a control that passes | |

## Failure injection

No failure injection is qualified anywhere in the repo or on #162 (no `route.fulfill`, `route.abort` or `setOffline`
in any reviewed lane). This lane therefore adds none. BA-P1 to BA-P5 stay PENDING until the shared owner reviews and
qualifies one, for example a page-scoped `page.route` on exactly one REST path that fails one request with a fixed
status. That decision belongs to the shared owner, not to this lane.

## Data

- Seed (`scripts/builder-authoring-fixture/seed.sql`): plain INSERTs in one transaction, ids in the 9b6e0000 namespace
  (`ids.mjs`): 2 draft courses owned by e2e-instructor (e2e00000-0000-4000-8000-000000000002), 5 sections, 5 lessons.
  No ON CONFLICT, so a leftover id makes the seed fail instead of reusing rows.
- Cleanup (`manifest.mjs`): one transaction; first proves every listed course is owned by e2e-instructor and every
  wizard-created course has exactly this run's nonce title, raising BA_CLEANUP_E_* otherwise; then deletes quizzes,
  assignments, content_items, modules and courses for exactly the listed course ids. No pattern deletes.
- Selftest (`tests/selftest.mjs`, fake, no DB): 7 checks on ids, seed shape and manifest refusals.

## Dependencies (explicit)

1. **#142 (lesson persistence base).** #165 is stacked on `claude/lesson-save-persistence` (5b3fdce), not on main.
   CourseBuilder's lesson save queue and LessonEditor come from #142. This lane tests the #165 head and so needs
   #142 then #165 on the tested ref. Stacked PRs run neither test.yml nor e2e.yml, so no green on this chain
   counts for this lane until it is on a ref the shared job runs.
2. **#162 / #156 runner pattern (head 77beaefe).** Reused unchanged and imported by path; none of them exist on this
   branch's base, so `run.sh` refuses `RUN_E_DEPENDENCY` without them:
   - `e2e/gradebook-roles/local-binding.mjs`, `origin-guard.mjs`, `journey/private-dir.mjs`
   - `scripts/gradebook-fixture/journey/private-psql.mjs`, `pairing-producer.mjs` (`pins`, `dsn`, `ownership`, `appverify`)
   - `scripts/e2e/assert-safe-target.mjs`, `stack-ownership.mjs`, `gb-job-psql.mjs`, `gb-launch-binding.ts`
   - `scripts/local-stack/**` (bootstrap snapshot, seven pinned migrations, stack-net, owned-proc, no-Edge probes)
   - the D1 stack-ownership record, written by the job before any fixture or actor write
   - the base actors from `local-preseed.sql` plus `auth-fixtures.sql` (e2e-instructor, e2e-member)
3. **Shared files (serialized through the shared owner, not committed here):**
   - `.github/workflows/e2e.yml`: a `builder-authoring` job, the exact diff is in the packet as a proposal;
   - `scripts/e2e/gb-launch-binding.ts`: needs a `builder-authoring` lane that resolves
     `playwright.builder-authoring.config.ts` to the pinned shell;
   - `src/test/ci/check*Job.test.ts`: a static checker for the new job, like the gradebook one.
4. **T-55 (PR134).** Any change to the reorder RPCs belongs there; this lane uses whatever RPC the tested ref has.

## Next executable proof

One `builder-authoring` run of the shared job on a ref that carries #142, #165, this branch and the #162 runner
files, dispatched by the user. Pass means: seed PASS, `PLAYWRIGHT expected=11 unexpected=0` (BA-R1, BA-R2, BA-C1 at
three viewports plus BA-D1, BA-D2 at 1440; the four 768/390 delete entries are skipped by design), cleanup PASS,
inventory exactly four files. Until then every row above is source only.
