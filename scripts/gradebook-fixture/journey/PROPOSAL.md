# No-quiz authentic UI journey: publish, enroll, upload, grade, readback, certificate (PROPOSAL, UNRUN)

**Status:** proposal plus local checks only. Nothing here has run against any GoTrue, PostgREST, Storage, database or browser stack. Nothing was dispatched, pushed or published, and there are no production writes. The journey **cannot run yet**: gate 3's producer does not exist, so the setup fails closed by design.

**Base:** the qualified grading fixture db3ba0a (tree aa07052f), which sits on #139 644504d. It is NOT current main. The grading lane is unchanged: `playwright --list` with `GB_LANE` unset still lists the same 18 tests, line for line, as the db3ba0a receipt.

**Owned paths only:** `e2e/gradebook-roles/journey/**`, `scripts/gradebook-fixture/journey/**`, and one lane switch in `playwright.gradebook-roles.config.ts`. No workflow, shared runner (`scripts/e2e`, `e2e/support`), migration or product source was edited.

## 1. The journey (one persona per Playwright project, chained)
| Step | Persona | Route and UI control | Real backend path exercised | Oracle |
|---|---|---|---|---|
| J0 | learner | `/courses`, `/courses/:id` while the course is a draft | courses RLS (published-only read) | The course is not listed, there is no Enroll control, and 0 enrollment POSTs are sent |
| J1 | instructor | builder `[data-onboarding=builder-publish]` | `updateCourse` PATCH under the instructor's RLS | Sent `published=true, status=published`; exactly 1 row back; reload shows Unpublish |
| J2a | learner | catalog card, then detail, then **Enroll for free** | enrollments INSERT | Sent user/course; 201; reload shows Continue learning |
| J2b | learner | page lesson, scrolled to the end (scroll sentinel) | progression upsert, `can_access_content_item` restrictive policy | Sent `read` for the page; certificate page still locked |
| J2c | learner | assignment lesson, file input, **Submit** | Storage upload to `course-documents/submissions/<course>/<learner>/` (`course_submission_insert`); submission INSERT; `submission_attachments` INSERT; `enforce_assessed_progression` | Viewing or scrolling writes 0 progressions. One `submitted` row (attempt 1, `online_upload`, grade NULL). One attachment row storing the object key, with the exact byte size. Reload shows "Submitted · Attempt 1" and the file |
| J2c (end) | learner | `/courses/:id/certificate` | `auto_issue_certificate_on_progression` (r5 evidence rule) | "Your certificate is ready", issued **before** any grade (see section 2) |
| J3a | instructor | SpeedGrader, **Download** | `supabase.storage.download` under `course_submission_select` (staff branch) | Downloaded bytes sha256 = uploaded bytes sha256; filename exact |
| J3b | instructor | SpeedGrader grade 7, feedback, **Save** | #139 writer PATCH plus readback | Sent grade 7, `<p>feedback</p>`, `graded`; exactly 1 row back; reload shows 7 and the feedback |
| J4a | learner | assignment lesson, two fresh loads | learner SELECT on own row | "Graded · Attempt 1 · Score 7 / 10"; the typed feedback is shown as **text, with no markup**. **Expected to FAIL on #139 source** (finding F1) |
| J4b | learner | own file button (signed URL popup) | learner `course_submission_select` (own branch) | Response 200; body sha256 = upload; the URL is never logged or attached |
| J4c | learner | `/courses/:id/grades`, `/courses/:id/progress` | read paths | 7 / 10; 100% |
| J4d | learner | certificate page, **Download**, `/verify-certificate/:code` | certificates SELECT (owner), client PDF | Ready and "already issued"; the PDF is named `certificate-<shown code>.pdf`; verify accepts the code as the owner |

**Seed** (`seed-journey.sql`): ONE draft course shell with 1 published module, 1 page and one 10-point, single-attempt, upload-only assignment. It does not create an enrollment, progression, submission, object, attachment, grade, audit event, notification or certificate, and it creates no policy, trigger, function, grant or bucket. Pristine refusals cover a used stack, a staff learner, a public bucket and pre-existing objects.

**Witness** (`witness-journey.sql`, read-only) records:
- exact journey-scope lines (COURSE/ENROLL/PROG/SUB/ATT/OBJ/CERT/AUDIT/NOTIF);
- a **MANIFEST** of every journey-scope row id, where the post minus pre difference is the run-created set;
- NULL- and position-preserving hashes of everything else, including other storage objects and buckets.

Expected post-state is in `expected-journey-post.txt`. AUDIT and NOTIF multisets are deliberately **not yet pinned**: they need a read of the #139 and r5 triggers in review.

**No cleanup SQL exists.** The stack is disposable and destroyed with the job. The manifest is the ownership record. This follows the user's rule that only fixture rows the run created may ever be targeted.

## 2. Eligibility, exactly as the source has it (nothing invented)
- The certificate counts every published item. A page counts when it is `read`. An assignment counts when it is `read`/`completed` AND has a final submission (`is_final_assignment_submission`: `graded`, or `submitted` with `submitted_at`).
- **There is no grade or pass threshold.** The certificate is therefore issued at J2c, before the instructor grades. The journey asserts that, and the witness proves `issued_before_graded=true`; grading must not reissue the certificate.
- Whether a grade should gate the certificate is an **owner policy decision** (handoff section 9, "Completion policy... passing score must be explicitly decided"). It is not built or assumed here.

## 3. The four gates, and where each one stands for this lane
| Gate | This lane | Still needed (owner) |
|---|---|---|
| 1 Private 0700 session dir, 0600 files, always cleanup | `private-dir.mjs` checks the dir before any write: absolute, not a symlink, outside the repo, 0700, caller-owned, empty. Files use exclusive create (`O_EXCL`/`O_NOFOLLOW`) with mode 0600. Sessions are never written into the repo (the config refuses without an absolute `GB_SESSION_DIR`) | Creating the dir with mktemp, and **always** removing it on every exit (trap), belong to the runner. The lane's `run.sh` is not changed in this batch, and the unreviewed WIP diff is not used |
| 2 Sanitized fixed-code errors, private scanned outputs | Setup errors are fixed codes plus at most an HTTP status. The static contract fails if an error interpolates a body, message, token or password. Specs never log or attach URLs | Private raw logs with an exact scanned upload inventory: runner/workflow (PR 134 thread) |
| 3 Owned disposable stack and API to DB pairing BEFORE seed and first persona POST | `pairing-proof.mjs` is the consumer. Setup checks it **before the first sign-in POST**, and the static contract enforces that order. Shape: `{version:1, stack_id(128-bit hex), db_read, api_read, produced_before_seed:true}`, mode 0600 | **Producer missing.** It needs a stack-unique value written at bootstrap and readable with the anon key without a persona session. That likely needs a bootstrap change in `scripts/local-stack` (PR 134 thread). Until then the journey fails closed (`JOURNEY_GATE3_E_NO_PROOF`) |
| 4 Hermetic served-app contract without the editor CDN | The origin guard is reused unchanged: any non-approved origin is blocked before send and fails the test | The served-app contract (proposal `pr134/hermetic/hermetic-served-app-f169429`, blocker `cdn.gpteng.co` in index.html) belongs to the PR 134 thread |

**Shared integration requested, as a proposal only (not edited):**
1. A gate 3 producer in the stack bootstrap.
2. A runner path that runs `GB_LANE=journey` on its **own** fresh stack, never the grading fixture's stack. Each witness protects the other's rows, so a shared stack would break both.
3. A `gradebook-journey` dispatch scope. Each writable scope needs review plus a specific run approval.

## 4. Source observations found while mapping (recorded, NOT fixed, no policy change)
- **F1 (predicted UI defect):** `InlineAssignmentSubmit` renders `grader_comments` as React text, but SpeedGrader stores HTML, so the learner sees `<p>…</p>` literally.
  - Proven at the mocked tier by `journey/feedback-render.test.tsx`.
  - Causal control: a stripped-tags variant of the component makes the characterization FAIL.
  - The grading fixture's learner spec uses substring `getByText`, which hides this. J4a uses exact text.
- **F2 (policy gap, from the snapshot):** the enrollments INSERT policy only checks `auth.uid() = user_id`. A direct API enroll into an unpublished course is not known to be refused, and J0 only proves the UI path. Not probed: no API shortcuts in this lane.
- **F3 (UI and issuer divergence):** `check_course_completion`, which drives "Your certificate is ready", does not apply the r5 evidence rule, while the issuer does. With legacy done rows, the page can say "ready" when no certificate is issued. The RPC is also SECURITY DEFINER, takes any `p_student_id`, and is granted to anon. The journey's fresh evidence keeps the two in agreement.
- **F4 (verification scope):** the certificates SELECT policies cover the owner and course staff only. Third-party `/verify-certificate/:code` may answer "Invalid". J4d verifies as the owner only.
- **F5 (local stack divergence):** `scripts/local-stack/localize.sql` creates `course-documents` with no MIME allowlist or size limit, and `course-images` as public. Hosted bucket config is unknown, so upload acceptance on the local stack may not match hosted.

## 5. Local checks (exact commands; see receipts for outputs)
| Command | Exit |
|---|---|
| `node scripts/gradebook-fixture/journey/tests/static-contract.mjs` | 0 PASS |
| `node scripts/gradebook-fixture/journey/tests/journey-selftest.mjs` (gate 1 x13, gate 3 x10, static contract real tree + 20 causal mutations) | 0, 44 ok |
| `npx vitest run --config e2e/gradebook-roles/journey/vitest.journey.config.ts` | 0, 1/1 |
| Same, with the component's feedback line temporarily tag-stripped (reverted; blob 7b1d914e restored) | 1 (control fails as required) |
| `npx tsc --noEmit -p tsconfig.json` | 0 |
| Direct tsc over journey files, config and grading specs (scratch tsconfig in receipts) | 0 |
| `npx eslint e2e/gradebook-roles/journey playwright.gradebook-roles.config.ts scripts/gradebook-fixture/journey` | 0 |
| `playwright --list`, grading lane (GB_LANE unset) | 0, 18 tests, identical to the db3ba0a receipt |
| `playwright --list`, `GB_LANE=journey` | 0, 12 tests in 5 projects |
| `--list` with journey lane and no session dir / bad lane value | 1 / 1 (refused) |
| Repo CI target/DSN checker tests (3 files) | 0, 33 |

The list runs used placeholder loopback env values. No server was listening, and nothing was contacted.

## 6. Not done and not claimed
- No authentic evidence of any kind: every journey case is **UNRUN**, and J4a is expected to fail.
- Selectors were written from source reading and have never matched a rendered page.
- The AUDIT and NOTIF oracles are unpinned. The runner that binds `<ID:…>` placeholders and diffs pre/post is described, not written.
- No mobile/tablet viewport, accessibility or Firefox coverage. Desktop Chromium only.
- No product, policy, migration, workflow or shared-runner change. F1 to F5 go to their owners.
