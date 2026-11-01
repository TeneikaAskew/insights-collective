# No-quiz authentic UI journey: publish, enroll, upload, grade, readback, certificate (PROPOSAL r3, UNRUN)

**Status:** a proposal plus local checks only. It is not run-ready.
- Nothing here has run against any GoTrue, PostgREST, Storage, database or browser stack.
- Nothing was dispatched, pushed or published. There are no production writes.
- Receipt label: **123 fake/unit/static checks (selftest; helper and comparator behaviour on fakes, NOT journey executions) / 1 mock (vitest characterization) / 12 journey list + 18 grading list preserved / tsc / lint inspected; no authentic journey.**

**History:** 5d9714b (frozen) → bc65540 (r2, the 22:14Z review batch; its security holds, A and D are closed) → r3, the small oracle-only batch for the 22:48Z recheck (section 9). Every earlier commit and export is kept unchanged.

**Base:** the qualified grading fixture db3ba0a (tree aa07052f), on #139 644504d. This is NOT current main.

**Grading lane is unchanged.** With `GB_LANE` unset, `playwright --list` gives the same 18 tests, line for line, as the 5d receipt, which equals the db3ba0a receipt. The #139 product patch is untouched.

**Owned paths only:**
- `e2e/gradebook-roles/journey/**`
- `scripts/gradebook-fixture/journey/**`
- the lane switch in `playwright.gradebook-roles.config.ts`, unchanged since 5d

No workflow, shared runner (`scripts/e2e`, `e2e/support`), migration or product source was edited.

## 1. Still BLOCKED (no shared-file edits in this lane)
1. **Gate 3 producer and ordered pre-seed runner.**
   - `pairing-proof.mjs` is a consumer of shape and placement only.
   - The five values in a proof file are written by the caller, so they are NOT trusted current-run, API, DB or owner proof.
   - Accepting a file only means "the shape is right".
   - The producer and the order in which the runner calls it belong to the PR 134 thread.
2. **Shared owned-stack pairing** before seed and before the first persona request. Same owner.
3. **Always-cleanup** of the session, proof and diagnostics dirs on every exit, plus an exact inventory of uploaded outputs. These belong to the runner.
4. **Hermetic served-app contract** (f169429, editor CDN). Owned by the PR 134 thread.

## 2. Security corrections (review: SECURITY)
- **Proof vs session dir.** The session dir must be EMPTY when setup starts (gate 1), so the proof can never live inside it.
  - `assertPairingProof(file, { sessionDir })` refuses with `JOURNEY_GATE3_E_IN_SESSION_DIR` when the proof is in or under the session dir, or the session dir is under the proof's dir.
  - It refuses with `JOURNEY_GATE3_E_PARENT` unless the proof's own dir is 0700, owned by the caller, and not a symlink.
  - The selftest covers both, with fake controls.
- **Outer fixed-code setup boundary.** Every step of `session-setup.ts` runs inside `stage(code, fn)`. That covers binding, launch, context, addInitScript, newPage, goto, settle, storageState, serialize, the exclusive write, stdout, and the final directory listing.
  - A `JourneyGateError` passes through unchanged. Any other error becomes that step's fixed code.
  - A last outer wrapper maps anything left to `JOURNEY_SETUP_E_UNCLASSIFIED`.
  - Raw error name and message go only to `GB_DIAG_DIR`. That is its own fresh 0700 dir (gate 2 check), refused if it is the session dir, with 0600 files. If it is unset, raw diagnostics are dropped.
  - `browser.close()` always runs. A close failure never masks the first error, and it is reported only when nothing failed before it.
- **Kept as before:** 0700 dirs, `O_EXCL|O_NOFOLLOW` 0600 files, the origin guard, and the gate order. The order is enforced by the static contract (R6): binding, then gate 1, then optional gate 2, then composition `composed-r5`, then gate 3, all before the sign-in POST.
- **After setup** the session dir must hold exactly `instructor.json,member.json`. J2c later adds the private `run-state-j2.json` (0600, exclusive create) for J3 and J4.

## 3. The journey (one persona per Playwright project, chained)
Observation is at request level (`observe.ts` over the pure core `observe-core.mjs`). It records every request the app STARTS, together with its terminal state. Each expectation requires:
- the exact origin, method and path, and the exact query (any non-passthrough key that is not named makes it a near-miss, and near-misses fail);
- the exact count after a settle window, so a late duplicate fails;
- a finished, not failed, request with an allowed status;
- with `ordered` (J2c only), the first start of each expectation in the declared order (upload, submission, attachment, progression; the app awaits each step).

The core's codes (OBS_COUNT, OBS_PENDING, OBS_FAILED, OBS_STATUS, OBS_NEAR_MISS, OBS_ORDER) are exercised on a fake emitter in the selftest. Those are helper checks, not journey executions.

The journey never sends a write itself. Its only own reads are the response bodies of the app's own requests.

| Step | Persona | UI action | Request-level oracle | Other oracle |
|---|---|---|---|---|
| J0a | learner | `/courses` | none | Settled catalog: the published **control course** card is visible exactly once, and the draft course title has count 0 |
| J0b | learner | control detail, then draft detail | 1 GET `courses?id=eq.<draft>` with terminal **406** (`.single()` on zero rows); 0 enrollment POSTs started | The control title renders (positive control), "Failed to load course" is shown (denial control), no Enroll button |
| J1 | instructor | builder Publish | 1 PATCH `courses?id=eq.<course>`, 200 | Sent `published=true, status=published`; 1 row back with the same id; reload shows Unpublish |
| J2a | learner | catalog, detail, **Enroll for free** | 1 POST enrollments, 201 | Sent user and course; reload shows Continue learning |
| J2b | learner | page lesson, scroll | 1 POST `content_item_progressions?on_conflict=user_id,content_item_id`, armed before navigation | Sent `read` for the page. Progress page: **Course Completion 50%, Lessons 1 of 1, Assignments 0 of 1**. Certificate page: the app's certificate GET returns **0 rows** |
| J2c | learner | assignment lesson, file, **Submit** | Viewing starts 0 progression POSTs. Then exactly 1 each: Storage POST under `submissions/<course>/<learner>/`, submission POST 201, attachment POST 201, progression POST | Object key shape; submission id from the returned row; attachment `submission_id` = that id and `url` = the uploaded key; exact size. Reload shows "Submitted · Attempt 1". Progress **100%, 1 of 1, 1 of 1** |
| J2c (end) | learner | certificate page | 1 GET `certificates?user_id=eq.<learner>&course_id=eq.<course>` (passthrough select/order) returns **exactly 1 row** | Issued card shows that code. Id, code and issued_at are saved to the private run state **before grading** |
| J3a | instructor | SpeedGrader **Download** | 1 POST `rpc/log_submission_file_access` with exactly `{p_submission_id: known, p_action: file_downloaded, p_attachment_id: known, p_filename}` and 1 GET `/storage/v1/object/course-documents/<known key>` with no query | Downloaded bytes sha256 = upload sha256; filename exact |
| J3b | instructor | grade 7, feedback, **Save** | 1 PATCH `assignment_submissions?id=eq.<known submission id>`, 200 | Body keys exactly grade, graded_at, grader_comments, workflow_state. Returned id = known id; returned graded_at = sent instant. Reload shows 7 and the feedback |
| J4a | learner | assignment lesson, 2 fresh loads | none | "Graded · Attempt 1 · Score 7 / 10"; feedback by **exact text**. **Expected RED (F1)** |
| J4b | learner | own file button | 1 POST `object/sign/course-documents/<key>`, with a context-level response wait for the exact GET of that object path **armed before the click** | 200; body sha256 = upload. The URL is never logged or attached |
| J4c | learner | grades, progress | none | Grades row 7 / 10. Progress 100%, Lessons 1 of 1, Assignments 1 of 1. **Average Grade 70.0%**, checked separately from completion |
| J4d | learner | certificate page, **Download** | 1 certificate GET returning 1 row with the **same id, code and issued_at** as recorded in J2c | PDF named `certificate-<code>.pdf` |

**J4 is not serial.** J4a's expected F1 failure does not skip J4b to J4d (static contract R7).

**Not covered, DEFERRED (review A): public certificate verification.**
- The real chain: `/verify-certificate/:code`, then `VerifyCertificate.tsx` lines 40 to 53 (a `fetch` to `/functions/v1/verify-certificate`), then the public **verify-certificate Edge function**. That function uses the service role to call `verify_certificate` and `rate_limit_certificate_verify`.
- The rate-limit RPC inserts `certificate_verification_attempts` rows and prunes rows older than 24 hours.
- This journey runs with **no Edge runtime**. The segment is therefore out of scope: no stub, no backend fix, and no navigation to the route (static contract R8).
- It is not an owner-only SELECT denial, and 5d was wrong to call it one.
- A future, separate Edge scope would use this oracle: "Verified certificate" plus the exact code and course title. The absence of "invalid format" would not be enough.

## 4. Certificate claim, scoped exactly (review B)
- **Corrected in r3.** The positive path "certificate exists right after submission, before any grade" is **not** specific to composed-r5. The baseline issuer (`auto_issue_certificate_on_progression`, `scripts/local-stack/schema/03_functions.sql` about lines 2292 to 2370) already issues when every published item has a `read`/`completed` row, with no grade threshold. So this legitimate positive **also passes on the old issuer**, and it does not prove r5.
- **composed-r5 is still the required acceptance target:** the ic_base snapshot plus the pinned T-09 000500 (blob de4f8c27) and 000600 (blob 8d520861). Setup refuses unless `GB_COMPOSITION=composed-r5` (`JOURNEY_SETUP_E_COMPOSITION_NOT_R5`).
- What r5 adds is **final-evidence safeguards** (an assessed item counts only with a final submission: `graded`, or `submitted` with `submitted_at`), not this positive-path timing. This journey does not exercise the negative case (a read-only assignment row without a submission), so it makes no r5-specific safeguard claim.
- No SQL, policy or product change.
- Proof comes from the app's own scoped certificate SELECT and the issued card, never from a page heading. J2c's legacy "ready" heading is not proof (F3).

## 5. Seed, witness, expected state, comparator (review C)
- **Seed** (`seed-journey.sql`, inserts only, pristine refusals):
  - the draft course shell (1 module, 1 page, 1 ten-point upload assignment);
  - one **published control course** (1 module, 1 page, no enrollment) for J0 and for non-empty protected scopes.
- **Witness** (`witness-journey.sql`, read-only):
  - **AUDIT:** every column, including submission, attachment, filename, module and `details::text`.
  - **NOTIF:** title, message and link.
  - **Hashes added:** other modules, other items, other assignments, quiz_submissions, quiz_submission_answers, grade_change_notifications, certificate_verification_attempts (guarded with `to_regclass`; an absent table prints ABSENT, which FAILS), and the journey course row minus `published`, `status` and `updated_at`.
- **Expected pre** (`expected-journey-pre.txt`): only `COURSE … published=false status=draft`, and an empty journey manifest.
- **Expected post** (`expected-journey-post.txt`): fully pinned from source, with no OBSERVED values. It includes:
  - `completion_status=0` (the column defaults to 0 and the app does not write it);
  - size 329 and the feedback md5, both cross-checked against `ids.ts` by the selftest;
  - 2 AUDIT lines:
    - `file_downloaded`: instructor actor, known submission and attachment, `details={}`;
    - `grade_posted`: `details={"new_grade": 7.00, "new_workflow_state": "graded", "old_workflow_state": "submitted", "rubric_scores_changed": false, "grader_comments_changed": true}` (grade is numeric(10,2); `old_grade` NULL is stripped);
  - 3 NOTIF lines: 1 staff submission notice, 1 learner receipt and 1 learner grade notice, with exact title, message and link;
  - 12 `ADDED` manifest rows.
- **Comparator** (`tests/compare-witness.mjs`, run on fakes only):
  - Binds `<ID:name>` consistently and distinctly across lines.
  - Requires the journey lines to equal the expected multiset exactly, with no extra and no missing lines.
  - Requires every bound id to be an added row of its table, with no extra, missing or removed manifest rows.
  - Requires EXACTLY the 21 declared HASH scopes (`DECLARED_HASHES`, checked against the witness SQL by the selftest and static contract R10) in BOTH witnesses, once each, with no undeclared scope. A scope missing from both sides fails as missing on both sides; missing is never treated as unchanged.
  - Validates the hash grammar: counted `<n≥1> <32-hex md5>` or `0 empty`; the two single-row shell hashes as a bare 32-hex md5; `certificate_verification_attempts` may print `ABSENT`, which FAILS.
  - Requires every HASH to be equal before and after.
  - A HASH that is empty in both is reported as **UNPROVEN-EMPTY** (a narrowed claim, not protection). It FAILS for the required non-empty scopes (other_courses, other_modules, other_items, buckets), which the control course and the bucket make non-empty.
  - Fake controls: a faithful full-inventory fake (21 scopes, empty histories reported UNPROVEN-EMPTY) passes. Causal old-fail controls: the bc65540 comparator ACCEPTED a both-side omission (grade_history + other_submissions), an undeclared extra scope, and a malformed 4-hex hash; the r3 comparator refuses all three. Also refused: post-only omission, duplicate line, uppercase or 33-char md5, count without md5, `0 <md5>`, `3 empty`, leading-zero count, single-row hash with a count, ABSENT on a non-guarded scope.
  - Earlier fake controls kept: a faithful fake passes. Each of these fails with its own code: wrong row, inconsistent binding, missing event, extra event, extra manifest row, bound id not added, non-empty pre manifest, changed hash, empty required scope, non-pristine pre, unknown line.
- **Narrowed claim.** Protection covers only the hashed scopes listed in the witness. It says nothing about:
  - auth/profiles beyond what the witness hashes;
  - other schemas;
  - Storage object **bytes** (the witness lists object metadata, not content);
  - any table not listed.
- **No grade-history proof.** `grade_history` and `grade_change_notifications` are hashed as unchanged, which is the expectation from source because nothing on this path writes them. The journey makes no claim about grade history.

## 6. Findings (review D wording)
- **F1, valid MOCK characterization.**
  - SpeedGrader stores `<p>…</p>`, and the learner view renders `grader_comments` as text.
  - `journey/feedback-render.test.tsx` shows the literal tags at the mocked tier.
  - The 5d causal control (a tag-stripped component) made it fail. That control was not re-run in r2 or r3, because neither file changed.
  - J4a stays strict and red. The product fix is a separate scope, and no fix approach (such as stripping tags) is assumed.
- **F2, snapshot policy gap, not runtime.** The snapshot's enrollments INSERT policy checks only `auth.uid() = user_id`. It was not observed at runtime and is not probed (no API shortcuts).
- **F3, known; the SQL is not reopened.** The legacy `check_course_completion` "ready" heading and the r5 issuer can differ. The journey therefore never uses the heading as issuance proof.
- **F4, corrected.** See section 3, DEFERRED: the Edge chain. It is not an owner-only SELECT denial.
- **F5, unchanged from 5d.** On the local stack, `course-documents` has no MIME or size limit, and `course-images` is public.

## 7. Local checks (exact commands and exits in `receipts/`)
| Command | Exit |
|---|---|
| `node scripts/gradebook-fixture/journey/tests/static-contract.mjs` | 0 PASS |
| `node scripts/gradebook-fixture/journey/tests/journey-selftest.mjs` | 0, 123 ok |
| `npx vitest run --config e2e/gradebook-roles/journey/vitest.journey.config.ts` | 0, 1/1 (mock) |
| `npx tsc --noEmit -p tsconfig.json` and `npx tsc -b` | 0 / 0 |
| Direct tsc over journey files, config and grading specs (scratch tsconfig in receipts) | 0 |
| `npx eslint e2e/gradebook-roles/journey playwright.gradebook-roles.config.ts scripts/gradebook-fixture/journey` | 0 |
| `playwright --list`, grading lane | 0, 18, identical to the 5d receipt |
| `playwright --list`, `GB_LANE=journey` | 0, 12 tests in 5 projects |
| `--list`, journey with no session dir, and bad lane value | 1 / 1 (refused) |
| Repo CI target/DSN checker tests (3 files) | 0, 33 |

The list runs used placeholder loopback env values. No server was listening, and nothing was contacted.

## 8. Not done and not claimed
- The 123 selftest checks are helper, comparator, gate and static-contract behaviour on fakes and temp files. None is a journey execution.
- No authentic evidence. Every journey case is **UNRUN**, and J4a is expected red.
- Selectors and request shapes come from reading the source. None has met a rendered page or a live API.
- The comparator ran on fakes only. No real witness exists.
- Desktop Chromium only.
- No product, policy, migration, workflow or shared-runner change.

## 9. r3 oracle-only batch (22:48Z recheck)
1. **Comparator inventory and grammar** (`tests/compare-witness.mjs`): exact 21 declared scopes on both sides; grammar per kind; full-inventory positive; causal old-fail controls (see section 5).
2. **Progress oracle** (`progress-oracle.ts`): each count-bearing node (the completion percent span, the muted count paragraph under Lessons and under Assignments, the Average Grade value) must exist once and match its whole text, so `11 of 1 completed` cannot pass for `1 of 1 completed`.
3. **Run state**: the submission, attachment and certificate UUIDs, the 12-hex code, the full ISO `issued_at`, the object key shape and the exact key set are validated (`runStateFailures`) BEFORE the private file is written, and again on read. There is no `String()` coercion, so an absent value fails instead of becoming "undefined".
4. **Observer**: logic moved into `observe-core.mjs` unchanged in meaning, plus an `ordered` option, and fake controls for start, terminal, pending, failed, duplicate, wrong query, foreign origin, other method, sibling prefix, order and stop().
5. **Wording**: section 4 and the J2/session-setup comments are corrected; composed-r5 stays the acceptance target.
