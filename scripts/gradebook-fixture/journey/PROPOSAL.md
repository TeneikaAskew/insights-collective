# No-quiz authentic UI journey: publish, enroll, upload, grade, readback, certificate (PROPOSAL r3, UNRUN)

**Status:** a proposal plus local checks only. It is not run-ready.
- Nothing here has run against any GoTrue, PostgREST, Storage, database or browser stack.
- Nothing was dispatched, pushed or published. There are no production writes.
- Receipt label: **211 fake/unit/static checks (221 with the shared D1 module applied locally) (selftest; helper and comparator behaviour on fakes, NOT journey executions) / 1 mock (vitest characterization) / 12 journey list + 18 grading list preserved / tsc / lint inspected; no authentic journey.**

**History:** 5d9714b (frozen) → bc65540 (r2, the 22:14Z review batch; its security holds, A and D are closed) → r3, the small oracle-only batch for the 22:48Z recheck (section 9). Every earlier commit and export is kept unchanged.

**Base:** the qualified grading fixture db3ba0a (tree aa07052f), on #139 644504d. This is NOT current main.

**Grading lane is unchanged.** With `GB_LANE` unset, `playwright --list` gives the same 18 tests, line for line, as the 5d receipt, which equals the db3ba0a receipt. The #139 product patch is untouched.

**Owned paths only:**
- `e2e/gradebook-roles/journey/**`
- `scripts/gradebook-fixture/journey/**`
- the lane switch in `playwright.gradebook-roles.config.ts`, unchanged since 5d

No workflow, shared runner (`scripts/e2e`, `e2e/support`), migration or product source was edited.

## 1. Still BLOCKED (no shared-file edits in this lane)
1. **Gate 3 producer and ordered runner: now a gradebook-owned adapter (section 11), runs still BLOCKED on D1.**
   - `pairing-producer.mjs` + `run-journey.sh` produce proof v2 from observed DSN and anon-API reads; `pairing-proof.mjs` re-reads the carrier live before sign-in.
   - D1 consumer wired (section 12) to the shared owner's `scripts/e2e/stack-ownership.mjs` (draft #154 head 9fa71e4, NOT in this branch's base). While it is absent, step 0 pins refuse, so the adapter cannot run.
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
| `node scripts/gradebook-fixture/journey/tests/journey-selftest.mjs` | 0, 138 ok |
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
- The 138 selftest checks are helper, comparator, gate and static-contract behaviour on fakes and temp files. None is a journey execution.
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

## 10. r4 inherited-key fix (23:37Z review, P2)
- `compare-witness.mjs`: `DECLARED_HASHES` is now a frozen null-prototype object, and membership is an own-key check (`isDeclared`). A `HASH toString`, `HASH constructor` or `HASH __proto__` line is now `W_HASH_UNDECLARED_*` on each side that carries it.
- `observe-core.mjs`: query membership is an own-key check, so an unexpected `toString`, `constructor` or `__proto__` query key is an `OBS_NEAR_MISS` and not an exact match.
- Selftest controls load the fcc606f versions from git. For each of the three names, the fcc606f comparator ACCEPTED it and the fcc606f observer MATCHED it. The new code refuses both. The full 21-scope positive, the allowed passthrough (`select`, `order`) and the null prototype plus freeze are kept as positives.
- Unchanged: product, SQL, config and the 18 grading cases. The pre-existing BOM lint error in `instructor-writers.spec.ts:125` stays as it is and stays disclosed.

## 11. Pairing producer and ordered runner adapter (T 23:53Z; file split agreed with the shared owner 23:56Z)
**Ownership.** New owned files: `run-journey.sh`, `pairing-producer.mjs`, `pairing-seed.sql`. Changed owned files: `seed-journey.sql`, `pairing-proof.mjs`, `session-setup.ts`, the tests. Workflows, `scripts/e2e/**`, `e2e/support/**`, stack bootstrap, f169429 and job-level cleanup stay with the shared owner, who alone wires the adapter into a workflow.

**Shared helpers reused unchanged.** Each is pinned by git blob id, and `pins` refuses on any drift:
- `assert-safe-target.mjs`: d94b9d6d
- `assert-local-dsn.mjs`: 9632c7b4
- `chromium-executable.ts`: ce26c40e

**Order (static contract R11):**
1. pins
2. `assert-safe-target --mutating`
3. strict binding
4. loopback DSN
5. **D1** (always refuses for now)
6. composition `composed-r5`
7. a private parent dir with proof, session and diag children (the trap removes exactly that parent)
8. **pair**
9. **seed**
10. witness pre
11. the journey (setup: proof v2, then the live recheck, then sign-in)
12. witness post
13. compare
14. exact evidence inventory

**Pair** (`producePairing`, with injected DB and API):
- P0: the DSN count of journey and control rows and objects must be 0.
- P1: `pairing-seed.sql` inserts ONLY the published control course row (fixed id `...0011`), with description `gb-journey-pairing:<128-bit nonce>`. RETURNING must give exactly 1 row.
- P2: the DSN readback equals the carrier.
- P3: anon API `GET courses?id=eq.<control>&select=id,description` returns exactly that row. The apikey is sent with no Authorization header. A random-id query must return `[]`.
- Proof v2 then holds only these observed values. `produced_before_seed` is gone, and v1 files are refused.
- The nonce is set inside psql's own script input. It is never in argv or env, and never printed.

**Seed binding.** `seed-journey.sql` no longer inserts the carrier. It refuses unless the carrier holds this run's value (`\gset` / `\if`).

**What this proves:** at pairing time and again before sign-in, the API origin the browser uses serves the row that this run wrote through `SUPABASE_DB_URL`.

**What it does NOT prove:** stack ownership or disposability (D1, the shared owner's `STACK_OWNERSHIP_FILE`, schema pending). A `disposable: true` field in that record would be a declaration, not proof. Its checkable parts are `GITHUB_RUN_ID` equality and a live PG `system_identifier` read.

**Disclosed:** the carrier row precedes the proof by design. Every other fixture row, and every persona request, comes after it.

**Fake controls in the selftest.** These are helper behaviour only, not journey executions:
- LIVE (13): accept; exact URLs; anon-only headers; mismatch; count; shape; not filtering; status; transport; parse; control id.
- PAIR (14): happy proof; order trace; carrier value; consumer accepts the produced proof; used stack with no insert; precheck type; insert conflict; DSN mismatch with no API call; two rows; API mismatch, count, filter and status; weak nonce before any DB call; no Authorization.
- PIN and D1 (6).
- RUN refusals that need no stack (3).
- G3 v2 shape (8), plus the causal check: the OLD 1673a7e consumer ACCEPTED the boolean v1 file and the NEW one refuses it.
- SC mutants for R1 pairing, R6 live and v2, and R11 order, trace, cleanup, logging and D1.

**UNEXECUTED:**
- `pairing-seed.sql`, the psql `\gset`/`\if` binding in `seed-journey.sql`, the real psql and fetch paths, and the trap on a full run. None has run against any database or stack.
- `scripts/gradebook-fixture/tests/origin-guard-selftest.mjs` needs a Chromium build that this container lacks. It fails the same way on 1673a7e. It was not run.

## 12. D1 stack-ownership consumer (shared schema v1, module 3875d202 at draft #154 head 9fa71e4, 2026-11-02 00:19Z)
- **Pins.** `scripts/e2e/stack-ownership.mjs` (3875d202; history 2bddca98 at 637bae9, then afa9ebd8 at 242cc88 with this lane's three findings, then 3875d202 at 9fa71e4 with a single O_NOFOLLOW descriptor read after a CodeQL fs-race alert) and its fake fixture (f1c384ec) join the three helpers. Neither file is in this branch: they live on the shared owner's draft #154 (branch claude/e2e-stack-ownership-record, head 9fa71e4, on main 32ccf7d), which is not merged into this branch. Until that commit is in the base, `pins` refuses with `RUN_E_PIN`.
- **Order.** Step 2 runs after the guards and before composition and every fixture read or write.
  - Its only DB contact is `select system_identifier from pg_control_system()`, read through this lane's guarded DSN.
  - The module is re-pinned immediately before it is imported.
- **Shared checks.** The shared `verifyRecord` checks:
  - the schema;
  - an exact 0600 mode and caller ownership (since 242cc88);
  - the expected api and app origins (`SO_ORIGIN_MISMATCH`, since 242cc88);
  - the size;
  - `run_id` and `run_attempt` against `GITHUB_RUN_ID` and `GITHUB_RUN_ATTEMPT`;
  - the live system identifier.
  Each refusal maps to `RUN_E_D1_SO_*`.
- **Lane checks (kept as defence in depth, same rules).** This lane also requires:
  - an exact 0600 regular file owned by the caller;
  - a non-empty run attempt;
  - the record's `api_origin` and `app_origin` equal to the strictly bound `VITE_SUPABASE_URL` and `E2E_BASE_URL`.
- **`disposable: true` is never proof.** It is the bootstrap's declaration. A refused verify with `disposable: true` still refuses.
- **Controls.**
  - 12 fake-verifier checks (D1).
  - 10 checks against the real shared module (D1REAL), run with the two #154 files at 9fa71e4 checked out into a scratch worktree. This lane's own mode check also uses one O_NOFOLLOW descriptor and fstat. They are SKIPPED, and not counted, in the tree as pushed.
  - Static contract R11 covers the origin checks, the exact mode, `SO_OK`, no use of `disposable`, and the pins.

## 13. 0f3c659 review correction batch (T 00:30:50Z; one batch, UNRUN)

1. **No DSN on any argv.** `private-psql.mjs` checks `SUPABASE_DB_URL` in-process with the pinned `assertLocalDsn` /
   `parseLibpqDsn`, runs psql with only `-X -q -At -w -v ON_ERROR_STOP=1 -h -p -U -d -f -`, puts the password in a fresh
   0600 passfile (O_EXCL, removed in `finally`) inside the private raw dir, sends SQL on stdin, and strips
   `SUPABASE_DB_URL` and every `PG*` override from the child env. The producer no longer spawns psql itself, and
   `local-binding.mjs` calls `assertLocalDsn` in-process instead of passing the DSN to a child.
2. **Raw streams private.** Every child's stdout and stderr goes to `$PARENT/raw` (removed by the trap on every exit).
   Playwright runs with `--reporter=json --output=$PARENT/raw/test-results`; `run-summary.mjs` turns its report into one
   count line and checks every comparator line against a fixed grammar. The evidence dir holds exactly five fixed files:
   `compare.txt composition.txt pairing.txt playwright-summary.txt seed.txt` (the old raw `playwright.txt` is gone).
3. **D1 record handle.** `readRecordHandle` opens with O_RDONLY|O_NOFOLLOW|O_NONBLOCK, fstats the same fd (regular,
   owner, exact 0600, 2..4096 bytes), reads at most 4097 bytes, refuses growth or shrink, and closes in `finally`. The
   shared verifier's record must equal the bytes read on that handle. Shared module repinned to ea39300d (#154 7e31eec);
   the shared file is not edited.
4. **First-write gates.** Gate 1: `EXPECTED_BOOTSTRAP_SHA256` is the reviewed constant b41a9ed8… (sha256 of
   `scripts/local-stack/bootstrap.sh`, blob aa34aa29, also pinned), re-hashed from the pinned file before use, never read
   from the record or the env. Gate 2: `SERVED_APP_VERIFIER` stays null, so `appverify` refuses `RUN_E_APP_UNVERIFIED`
   before the carrier INSERT. **The adapter remains BLOCKED** until the shared owner delivers a callable, pinnable
   served-app verifier (or an agreed equivalent) and the job runs it before D1.

Controls (fake tier only): HANDLE FIFO/dir/symlink/missing/oversize/growth/shrink/read/stat/close/bounded loop; PSQL argv,
passfile mode/content/removal, env stripping, remote/multihost/hostaddr/socket/PGHOST refusals; SUM grammar refusals;
RUNFAKE end to end on a tree copy with fake psql/npx and an in-process fake API: the happy order, then a marker-bearing
failure at every post-mktemp step, each checked for one fixed stderr line, no marker/password/DSN/nonce anywhere, parent
removed, exact evidence inventory.

## 14. Bounded synthetic PNG screenshot export (T 02:59Z; UNRUN)

- **Capture** (`observe.ts` `shot()`, rules in `e2e/gradebook-roles/journey/shot-core.mjs`):
  - Reads the page text with read-only Playwright APIs: body innerText, `page.content()`, every input/textarea/select value, title and URL.
  - Scans it before and after the screenshot for: this run's nonce (from the checked proof v2), the carrier prefix `gb-journey-pairing:`, both persona passwords, the anon key, and credential shapes (database URI, JWT, Supabase keys, service_role).
  - Any hit fails the test with a fixed `SHOT_E_*` code, and nothing is written.
  - A clean capture is written to the private `GB_SHOT_DIR` (0700, under the runner's parent) as `<name>.png`, plus `<name>.scan.json` with keys `{name, sha256, verdict:"clean", scans:2}`, both exclusive-create 0600.
  - Names come from a 16-entry allowlist, which the static contract keeps equal to the specs' `shot()` calls.
  - No other screenshot or attach call exists in the journey files.
- **Export** (`scripts/gradebook-fixture/journey/shot-export.mjs`), the only way out:
  - Allowlisted pairs only.
  - Each file is read on one O_NOFOLLOW|O_NONBLOCK handle: regular file, this uid, exact 0600, bounded size, bounded read, no growth, finally-close.
  - The scan record must be exact and clean, and its sha256 must equal the PNG bytes.
  - The PNG is re-encoded with IHDR/PLTE/IDAT/IEND only. Every chunk CRC is checked and the image data must inflate. Ancillary chunks, such as text/XMP/EXIF/time, are dropped, and unknown critical chunks refuse.
  - The re-encoded bytes must not contain the nonce or the prefix.
  - Output is `screenshots/<name>.png` (0600) and a manifest, `SHOT <name> sha256= bytes= width= height=` lines then `SHOTS n of 16`, validated by `run-summary.mjs shots`.
- **Evidence inventory** is now exactly: `compare.txt composition.txt pairing.txt playwright-summary.txt screenshots/ screenshots.txt seed.txt`. The PNG set must equal the manifest.
- **Limit.** Pixels are not OCR'd. The scan covers what the page renders as text, which is where a description or credential would come from on these synthetic pages. A static read at 324332ea finds the control course description on none of the 16 screens.
