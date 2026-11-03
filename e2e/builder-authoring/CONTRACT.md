# Builder authoring acceptance: contract (source; one hosted RED run, 41564184929)

Scope: course builder reorder (T-54), zero-row delete (T-54) and scratch creation (T-56) as frozen on #165 at c364f71d.
Real UI against a fresh disposable local stack in the shared runner job. Nothing here has run. No SQL, RLS or RPC change,
no production seed, no failure injection. The subset below cannot close T-54 or T-56 on its own: P1 to P5 stay PENDING.

## Controls

| Id | Control | Status | Proof (each step is a fixed `test.step` title used as the failure stage) | Viewports |
|----|---------|--------|---------------------------------------------------------------------------|-----------|
| BA-R1 | Section reorder (keyboard) is stored and rendered after reload | EXECUTABLE | `before_state`: stored ids are exactly A's three sections, positions exactly 0..n-1, rendered order equals stored. `ui_reorder`: Space/ArrowDown/Space on that section card's handle; exactly ONE `POST /rest/v1/rpc/reorder_modules`, terminal 200/204. `db_settled`: stored order is the move, positions 0..n-1. `after_reload`: rendered order equals it. `screenshot` | 1440, 768, 390 |
| BA-R2 | Lesson reorder (pointer) is stored and rendered after reload | EXECUTABLE | Same shape, scoped to section A1's card: membership is exactly its three lessons; the drag uses that card's first row handle and second row; exactly ONE `POST /rest/v1/rpc/reorder_content_items`; positions 0..n-1 before and after; rendered order inside the card after reload | 1440, 768, 390 |
| BA-C1 | Scratch creation makes exactly one course owned by the instructor, rendered and kept after reload | EXECUTABLE | `before_state`: the stored id set for title `BA Wizard Course <nonce>` (same nonce in every project) equals exactly the ids the earlier projects recorded: 0, then 1, then 2. `ui_create`: wizard, then the id from the builder URL is recorded. `db_settled`: the set is before plus exactly that id (so 1, 2, 3); owner, draft, 'Section 1' at 0, 'Introduction' page at 0. `rendered` and `after_reload`: the curriculum shows Section 1 with exactly Introduction | 1440, 768, 390 |
| BA-D1 | Applied delete removes the lesson | EXECUTABLE | `ui_delete`: the one visible `li` whose title button is exactly the lesson, its own "Lesson actions", its own Delete, the one `alertdialog` "Delete this lesson?", its "Delete lesson". Exactly ONE app `DELETE /rest/v1/content_items?id=eq.<id>` (select passthrough), terminal 200, body exactly `[{id}]`. `db_readback`: 200 and `[]`. `after_reload`: positive settled control (the section card renders its empty state and every A1 lesson renders once), then the lesson is absent | 1440 (768/390: intentional skip) |
| BA-D2 | Zero-row delete is refused and the item stays | EXECUTABLE | `out_of_band_delete`: a test-side REST DELETE (Node fetch, not the page) as the same instructor returns exactly that row. `ui_delete_refused`: the same scoped UI path; exactly ONE app DELETE with that exact query, terminal 200, body exactly `[]`; "Lesson not deleted" once; the row is still listed. `screenshot` (refusal, before reload). `after_reload`: positive settled control, then absent. A toast alone would also show on 403, 500 or no request at all, so it is never the pass condition | 1440 (768/390: intentional skip) |
| BA-P1 | Injected reorder RPC failure rolls back | PENDING | needs a reviewed failure injection; none is qualified for this lane. Author tier only: `reorderReconcile.test.ts`, `CourseBuilder.reorderDelete.test.tsx` | |
| BA-P2 | Overlapping reorders in one mount | PENDING | same; author tier only | |
| BA-P3 | Course switch while a reorder is pending | PENDING | same; author tier only | |
| BA-P4 | Interrupted create resumes to exactly one course | PENDING | same; author tier: `courseCreation.test.ts`, `CourseBuilder.wizardResume.test.tsx` | |
| BA-P5 | Changed-account or signed-out retry makes no writes | PENDING | same; author tier: A1 to A4, W5, W6 | |
| BA-L1 | Partial draft after reload | DISCLOSED LIMIT, not a pass | the plan is in memory only; a reload after a partial create leaves the partial draft and a new attempt starts a second course | |

Inventory: exactly 15 case/project entries = 11 executions + 4 intentional skips (D1, D2 in ba-768 and ba-390). Zero
extra, missing, duplicate or retried entries and zero global errors, or the summary fails. On failure each entry reports a
fixed stage and a fixed error class, never text. An intentional skip passes only as exactly one first-try result that is
itself `skipped`; a second result, a retry or an executed result fails the entry, as it does for a pass.

## Public values (finite maps, `scripts/builder-authoring-fixture/codes.mjs`)

Every value the lane prints is a map VALUE written in `codes.mjs` or a literal in the printing file, selected by an own-key
lookup on a frozen null-prototype map; input that is not an own key prints the map's fallback. No input is regex-sanitized
into an output. Maps: `STAGES` (the 11 step titles, else `unlisted`), `TEST_ERRORS` (the own codes specs throw, else
`unlisted`, or `timeout` / `assertion` / `other` without a BA_ token), `TEST_STATUS` / `RESULT_STATUS` (else `other`),
`CHILD_CODES` (ba-db, ba-shots and the pairing producer's literal codes; else `UNLISTED`, no refusal line `NONE`),
`SUMMARY_REASONS` (else `unclassified`). Observer and R1 diagnostic codes are products of fixed lists, so they stay
finite: `BA_OBS_E_<OBS_KINDS>` and `BA_R1_E_<OBS_KINDS>_<R1_DROPS>_<R1_SCROLLS>` (see "R1 diagnostic" below). Hostile, inherited-key (`__proto__`, `constructor`, `toString`, ...) and grammar
controls for all of them are in `tests/selftest.mjs`.

## Failure injection

This lane has no qualified failure injection and adds none (no `route.fulfill`, `route.abort`, `setOffline` or injection
variable). P1 to P5 stay PENDING until the shared owner qualifies one for this lane. This is a statement about this
lane only, not about the repository.

## Order inside `run.sh` (all before any write unless stated)

1. reused files present; `pairing-producer.mjs pins`; `REUSED_PINS` (exact git blob ids of the 9 reused #162 modules:
   capture `shot-core`, export `shot-export`, private `private-dir` and `private-psql`, `observe-core`, `pairing-proof`,
   `pairing-producer`, `local-binding`, `origin-guard`); target guard; strict loopback binding; DSN shape
2. pinned shell exported (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` = `GB_SHELL_PATH`); private parent `$RUNNER_TEMP/ba-run.XXXXXXXXXX`
   with 0700 children (proof, session, run, shots, raw); `GB_LANE=builder-authoring` launch binding (config's three projects)
3. D1 ownership and the served-app gate (pairing-producer `ownership`, `appverify`)
4. API/DB proof: pairing-producer `pair` (first write: the gradebook carrier, through the DSN; read back through the DSN
   and the anon API), then `ba-db.mjs seed`, which refuses unless this database holds exactly that proof's carrier
5. witness before; Playwright (session-setup re-checks the proof and the LIVE anon API before the sign-in POST)
6. after the browser attempt nothing refuses early: the Playwright and manifest summaries, the shots export, then ALWAYS
   the after-witness and its comparison are each attempted, whatever failed before (a missing or malformed report, a
   manifest error, a shots refusal). The FIRST failure is kept and reported (exit 3) only after that. A refused shots
   export stages `SHOTS REFUSED code=<map value>` and an empty dir; a refused after-witness stages
   `WITNESS FAIL kind=post_not_taken`. Then the exact 7-entry evidence inventory, every line in the shared staging
   grammar, the PNG dir equal to its manifest. Behavioural fake: `tests/tail-selftest.mjs` runs run.sh's own tail text.

No SQL cleanup. The job tears the disposable stack down (`supabase stop --no-backup`, owned network removal). Teardown
is not evidence of preservation; the witness is.

## Data and witness

- Seed (`seed.sql`): plain INSERTs, ids in the 9b6e0000 namespace: 2 draft courses owned by e2e-instructor, 5 sections,
  5 lessons. Refuses a used stack.
- Witness (`witness.sql`, read-only) before and after, exact scope:
  - course B, its sections and its lessons: the whole row, every column including `updated_at` (must be identical);
  - course A: every column EXCEPT `updated_at` (`to_jsonb(c) - 'updated_at'`);
  - A's sections and A's lessons: every column EXCEPT `position` (the reorder's target) and `updated_at` (the row trigger
    sets it on reorder): identical, except exactly the two one-shot lessons are gone;
  - mutation negative, live: a `probe` line per A projection counts, for every row and every column the row actually
    has, whether replacing that one value moves the projection's md5. The comparison requires every column but exactly
    the excluded ones to be sensitive, the same field count before and after, and prints it
    (`WITNESS_SCOPE ... a_course_fields= a_module_fields= a_item_fields=`). So a column left out by mistake, or added
    between the snapshots, fails; the count is reported, never assumed. (The generated types list 21/13/12 columns, so
    20/11/10 compared fields are expected; the run reports the live number. Run 41564184929 reported 18/11/10.)
  - **The witness does NOT prove R1 or R2 order.** Because `position` and `updated_at` are excluded from A's section and
    lesson projections, `WITNESS PASS` says only that nothing else changed. Stored order is proven by the specs'
    `db_settled` step (positions read back, 0..n-1, equal to the move) and rendered order by `after_reload`; a run where
    R1 fails can still print `WITNESS PASS`, as 41564184929 did.
  - one digest each over every course, module and lesson outside the fixture and the run's wizard courses (identical). Learner history on fixture courses (enrollments, progressions, certificates) is expected EMPTY and is
  reported as `preservation=not_exercised`: this lane does not test preservation of learner data.
- Screenshots: 10 PLANNED, not guaranteed and none taken yet (R1, R2, C1 at each width; D2 refusal at 1440), taken after
  the UI and stored rows settled, through the gradebook journey's capture window, guard and scan (unchanged) with this
  lane's plan, sound for these known synthetic pages; a capture that is not provably clean is WITHHELD with a fixed reason,
  and the spec's own result never depends on it. Export keeps critical PNG chunks only: stripping ancillary chunks is
  metadata removal, NOT pixel redaction.

## Writers (ordinary scoped review; no new policy exception; nothing relocated)

| File | Writes |
|------|--------|
| `run.sh` | `mktemp -d` private parent and its 0700 children; raw child streams by redirect (umask 077) under `raw/`; the evidence dir (`mkdir -m 700`, summary files by redirect, `cp` of seed/shots lines, `mv` of the exported PNG dir, the fixed refusal lines); trap removal of exactly its parent |
| `ba-db.mjs witness` | one witness file inside the private dir, `wx`, 0600 |
| `shot-plan.mjs` (`writeBaShot`) | `<name>.png` and `<name>.scan.json`, or only `<name>.withheld.json`, in the private shot dir: `open(O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW, 0600)`, `write`, `fchmod 0600`, `close`; the PNG only after the scan decision |
| `ba-shots.mjs` | the export dir (`mkdir 0700`) and its PNGs (`wx`, 0600), critical chunks only |
| `helpers.ts` (`recordCreatedCourse`) | `created-<project>.json` in the private run dir through the reused `writePrivateFile` |
| `session-setup.ts` | `instructor.json` storage state in the private session dir through the reused `writePrivateFile` |
| Playwright | `report.json` (JSON reporter) in the private run dir; `test-results/` under `raw/` |

Readers of private files use `readBounded` (no-follow, regular, single hard link, 0600, same uid, size cap) or the reused
`readHandle`.

## R1 diagnostic (finite, diagnostic only; the oracle is unchanged)

Run 41564184929 (ref 09412bcc) failed BA-R1 at 1440 in `ui_reorder` with `error=assertion`. From retained evidence that
stage has two possible failing assertions (section-card uniqueness in `helpers.ts`, or the observer's `expect` in
`observe.ts`), and the artifact carries neither the line, the RPC count, the status nor the failure array, so the cause is
NOT identified. A source-derived hypothesis (dnd-kit 6.3.1 `KeyboardSensor`: an ArrowDown that crosses the viewport middle
on a scrollable window calls `scrollTo({behavior:'smooth'})` and returns without moving `over`, so an immediate Space can
drop on itself and send zero RPCs) is a hypothesis only; no product or spec interaction change is made for it.

The next authorized run reports one fixed code instead of `assertion`, still failing on any deviation (exactly one
`reorder_modules` RPC, terminal 200/204, is unchanged):
- `BA_R1_E_LOCATE`: the section card or its handle was not uniquely located.
- `BA_R1_E_<obs>_<drop>_<scroll>`: the observer failed. `<obs>` is the first observe-core verdict kind by fixed precedence
  (`COUNT_ZERO`, `COUNT_UNDER`, `COUNT_OVER`, `STATUS`, `FAILED`, `PENDING`, `NEAR_MISS`, `ORDER`, else `OTHER`). `<drop>`
  compares dnd-kit's own default drop announcement (its live region; CurriculumView sets no custom announcements, and its
  sortable ids are the module ids) to the moving and target fixture section ids: `DROP_TARGET`, `DROP_SELF`,
  `DROP_OTHER`, `DROP_NONE` (dropped, no droppable named) or `NO_DROP` (no drop announced). `<scroll>` is `SCROLLED` or
  `STILL` (window.scrollY at failure versus after focus). Ids and counts are compared in the spec, never printed.
- `BA_OBS_E_<obs>`: the same verdict kind for every other observed action (R2, C1, D1, D2).

## Playwright inventory classification

The config chains projects (`ba-768` depends on `ba-1440`, `ba-390` on `ba-768`). When any test in a dependency fails,
Playwright reports every dependent test as `status=skipped` with `results=[]`. The summary now tells those apart instead of
counting them as executed failures, and still fails: an incomplete inventory is never accepted.
- `PLAYWRIGHT exit= entries= passed= failed= skipped= ...` is unchanged (failed counts every entry that is not as expected).
- `PLAYWRIGHT_BREAKDOWN executed_passed= executed_failed= dependency_unattempted= intended_skip_not_reached=
  intended_skipped=`. "Unattempted" is defined by report shape (skipped, zero results); the summary does not see the
  dependency graph, so it names the most likely reason, not a proven one.
- Per entry: `TEST FAIL ... reason=dependency_unattempted attempts=0` for an expected-pass entry never attempted, and
  `reason=intended_skip_not_reached attempts=0` for one of the four intended `test.skip` cases never reached (its skip call
  did not run, so it is not an intentional skip result).
- Run 41564184929 reads as: executed 4 passed and 1 failed (ba-1440 R1), 10 unattempted, of which 4 are intended skips not
  reached.

## Dependencies

1. **#142 then #165**: the tested ref must carry the lesson-persistence base and the #165 head (c364f71d).
2. **#162 runner modules (head 77beaefe), reused unchanged by path**: `e2e/gradebook-roles/{local-binding,origin-guard}.mjs`,
   `journey/{private-dir,pairing-proof,shot-core,observe-core}.mjs`, `scripts/gradebook-fixture/journey/{private-psql,pairing-producer,shot-export}.mjs`,
   `scripts/e2e/assert-safe-target.mjs`, the D1 record, `scripts/local-stack/**`, the preseed actors.
3. **Shared files, proposed as exact diffs to the shared owner (not committed here)**: the `builder-authoring` job in
   `e2e.yml`; the `builder-authoring` lane in `scripts/e2e/gb-launch-binding.ts`; `src/test/ci/checkBuilderAuthoringJob.test.ts`;
   `builder-authoring` added to the two exact option-list pins.
4. **T-55 (PR134)** for any reorder RPC change.

## Next executable proof

One user-dispatched `builder-authoring` run on the composed ref. Pass: `PAIRING PASS`, `BA_SEED_OK`, `PLAYWRIGHT exit=0
entries=15 passed=11 failed=0 skipped=4 missing=0 duplicate=0 unknown=0 global_errors=0`, `MANIFEST created=3`,
`WITNESS PASS`, `WITNESS_SCOPE` with the live field counts, `VERDICT PASS` in each summary, and the screenshots manifest
(captured or WITHHELD, each named).

## Evidence tiers (what is and is not shown)

Source and fakes, plus one hosted run (41564184929, RED; see above). The OLD 0/19 to NEW 19/19 review controls are static
wiring checks, not browser behaviour. The selftests are pure fakes: the R1 codes and the breakdown are shown against fake
reports shaped like that run, not against a browser. Earlier CanvasGrading notes: normal in-root CI installs avoid the
reproduced Vite "Denied ID" condition (it is not impossible in CI); the "same package bytes" statement in the symlink
control is author-reported, without a before/after inventory; control attempt 1 failed on module resolution, not Denied ID;
and a NEW tail selftest failing on OLD source shows a shape or precondition difference, not causal proof.
