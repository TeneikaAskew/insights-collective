# Insights Collective: independent cross-role, cross-device, release acceptance plan

Revision 6 (2026-11-07 00:00 UTC, answer save read-back added 14:50 UTC): new section 2.6 records the live student quiz-start check on the published site (one attempt created through the RPC and one answer saved by the test account; nothing else changed). Revision 5 (2026-11-05 12:00 UTC): new section 2.5 records the state after the eight November migrations were applied, the post-apply identity comparison, the merges and closes since revision 4, and what remains. Sections 2.1 to 10 are unchanged and stay true as of their own times. Revision 4 (2026-11-04 18:15 UTC): section 9 records the seven dispositions adopted at 18:11 UTC with their gates and owners, and 9b lists the outward steps this lane does not take and why. Revision 3 (17:50 UTC) folded in the 17:36 to 17:47 update (#172 c1c5e856, run 10, #146 535d33e6, gradebook d6dcb5bb), the direct read-only identity comparisons with their scope and timestamps, and the verified spec triage count. Revision 2 (after the 15:31 UTC review): evidence-tier corrections for the site marker, the ledger, the PR file pagination and E1 run 41839316072; retained requirements restated; R0 reworded as a coordinator proposal; owner deltas added in section 2.4.

Planning-only. Nothing in this document was executed: no source or configuration edit, push, merge, deployment, migration, database write, browser or provider run, security or access change, schedule, publication, or message to another agent. Read-only inspection only (repository at `main` 82a97196, GitHub REST through the MCP read tools, one read of the Supabase migration ledger, one HTTPS GET of the public site index). Stop point: this plan waits for the owner's approval before any run is dispatched.

## 1. Context

The handoff `03_Insights.md` (refreshed 2026-11-04 12:10 to 12:16 UTC) and the canonical tracker `docs/lms/backlog-tracker.md` r7.40 agree on the core conclusion: substantial LMS source exists, several narrow authentic slices have passed on the isolated local stack, and **no work package has whole-WP acceptance**. This plan does not re-plan the functional owners' implementation work. It builds the independent acceptance map that the owners' lanes feed into, assigns each requirement to its current source and its real evidence tier, orders the remaining runs by the smallest safe dependency path, and lists what a release needs beyond green checks.

Scope kept to the original core product: instructor authoring, learner journey, assessment, grading, permissions and privacy, catalog, lesson save/reload, quiz, gradebook, roster and reports, video, progress/completion/certificates. Communications, discussions, notifications (WP-11), prerequisites/drip (WP-13), commerce/interoperability (WP-16) and live cohorts are listed as deferred decisions, not planned work.

Retained original requirements (not open to "defer" by this plan): the real bulk import contract (WP-08, T-18); functional certificate customization that affects new certificates while every valid historical certificate stays readable and unchanged (WP-12, T-23); meaningful learner consumers for the theme presets and accent (WP-14, T-25); and completion defined with legitimate assessed submission as the minimum (WP-03). Hiding or removing a control never completes the requirement behind it. No historical achievement, grade, progression or certificate is changed by any run in this plan.

## 2. Reconciliation at 2026-11-04 14:50 UTC

### 2.1 What was verified now (read-only)

| Item | Handoff / 14:43 delta said | Verified now | Source |
|---|---|---|---|
| `main` | 82a97196 | 82a97196 at 14:45Z (origin/main fetched; local checkout equal). **Moved by 22:09Z to 8c3a6d2e** via #174 (`.claude/settings.local.json`: allows Supabase MCP tools without permission prompts) and #175 (`supabase/functions/resume-analyzer/sentenceDetector.ts`: two dead commented imports removed). Neither touches LMS product source, workflows, migrations or `docs/lms`; every head, file-list and evidence row in this plan remains as read. The served-site and catalog observations predate this move and are unaffected by its content. | `git fetch origin main` at 22:09Z |
| Open PRs | 27 at 12:10; #173 published later | 28 open, all Draft; #173 base `claude/sealed-video-base` f58fca5a, head 04f05811 | REST `pulls?state=open` |
| #172 head | a134131d (diagnostic) | a134131d; 10 source checks green at 12:32 to 12:41Z; E1 run 41839316072 FAILURE | REST check runs |
| Run 41839316072 | failed POST browser-label evidence; cleanup passed; approval consumed; root cause unresolved | Job 126606365642: steps 1 to 36 success through "Local actors and reference rows"; step 37 "Shared API<->DB pairing, then the sealed lane" FAILURE at 13:38:40 to 13:38:47Z; step 40 "LE-E1 summary" FAILURE; every teardown/cleanup/leftovers/private-removal step success; artifact `lesson-editor-41839316072` id 13328970000, 64,048 bytes, sha256 b2b4f70d... Per the owner's receipt (not re-read here; the artifact was not downloaded): the lane reached owned-browser launch and attestation, PRE AppArmor ENFORCE, Chromium connection and the test-scoped fixture, then reported POST `APPARMOR_E_UNKNOWN`. **The exact UI phase reached is unknown.** This is neither "before any browser action" nor an E1 PASS. Cleanup passed; E1 acceptance did not. | REST jobs + job log tail + owner receipt |
| #172 successor | head 860ae5cd, tree acb46f97, ancestry 860ae5cd -> 70826f20 -> ea4d9ffd -> a134131d, 311 independent in-memory checks, profile blob 1a11fef2, dispatch count nine, no new runtime | REST at 15:32Z: check runs for 860ae5cd show Security run 41857365135 all four jobs success; PR Checks 41857365099 success; CI/CD 41857365101 lint and both test jobs success, Build Application queued at 15:32:20Z. Commit messages and timestamps (ea4d9ffd 14:15:15Z "r2", 70826f20 14:36:10Z "r2.1 strict types", 860ae5cd 14:37:01Z "r2.1 control") are consistent with the stated ancestry; parent links, tree hash, the 311-check count and the profile blob were not independently re-read. | REST check runs + commit reads |
| #167 | nightly repair 6e5e5126 published, full CI green, still Draft | head 6e5e5126, 10/10 checks success 13:27 to 13:34Z, Draft | REST |
| #173 | source-only, stacked checks green | 1 check (Validate Pull Request) success 12:21 to 12:29Z; no Security, no CI/CD, no E2E | REST |
| #157 | fceb2cca, stacked green | head fceb2cca, base `claude/gradebook-journey-job` d5646387 | REST |
| #162 | a6d1d636 unchanged | unchanged | REST |
| #146 / #156 | 3e2d3b5f / d5646387 | unchanged | REST |
| Issue #168 | open, unassigned | open, no assignee, no labels | REST |
| Live migration ledger | no November entries as of Nov 3 17:54Z | Still none recorded: latest versions `20261031120009`, `20261031120030`. A missing ledger row alone is not proof of effect, so the effective state was read at 17:20Z (preparation 1, section B): the global instructor clause is still present on all three read policies; `start_quiz_attempt` has no `can_access_quiz` check and is still granted to anon; the guard still accepts `pending_review`; the identity triggers, the restrictive target policies and `is_final_assignment_submission` are absent; the #159 policies carry their old names and predicates. **Every November migration is not effective live**; ledger and catalog agree. | Supabase `list_migrations` + catalog reads |
| Published site identity | #151 at 22ef5450 published; #163 synced, unpublished (Nov 3) | **Changed marker, content-consistent.** Index served at 14:50:18Z carries `data-commit-sha="82a97196..."` and `data-artifact-id=6460eba6...`. The full served chunk graph (362 js files, walked to a fixed point) contains #163's roster strings and lacks #147's unique string (preparation 1, section A). This is marker plus content evidence that the served UI is `main`-era, **not byte identity** with a build of the tree; Edge Function versions were not read and Lovable History was not inspected. | HTTPS GET of `/` and `/assets/*` |
| `main` workflows | e2e.yml dispatch-only, `readonly-courses` only; db-migrate dispatch-only | Confirmed by reading both files on `main` | repo |

Consequence of the last two rows, within the scope and times stated in preparation 1 section C: the served JavaScript is at least post-#163 and pre-#147 by string presence/absence (17:14 to 17:22Z), and the backend lacks every distinguishing marker of the eight November files (17:20Z). That is consistent with a served UI that includes merged LMS code running against a backend whose November contract is not in force (C7, T-05, T-09, #159 as listed in preparation 1). It is a scoped observation, not a full deployment claim: bundle byte identity, Edge Function versions and the live md5 comparison against the 2026-10-31 snapshot identities remain unresolved (section 7, item 1). No data correction follows; it is the baseline for the apply plan.

### 2.2 Sources and artifacts not accessible from this session

- The five owner threads (PR134 coordinator, catalog, video, gradebook, quiz) at `claude.ai/code/project/...`: not readable here. Owner status is taken from the handoff, the 14:43 deltas and the tracker, not re-read.
- The three October 31 originals (`DOT_START_HERE.md`, master plan, Lovable prompt archive): not in the repository and not attached; their content is taken as summarized by the handoff and tracker section B.
- Lovable History / Publish panel: not accessible; the only deployment evidence is the served HTML marker above.
- Run artifacts (13328970000 for 41839316072, 13317828793 for 41822498879): not downloaded (the handoff records a CONNECT 403 to the blob host for the earlier one; no workaround attempted).
- Local unpushed work named in the deltas (ea4d9ffd diagnostic, fe92cc7c video, S5 adapter r3, A4/A8 sandbox-preserving route): not in any remote ref; not inspected.
- Production `pg_policies` for the #159 tables: not queried (the ledger absence of `20261102000000` is sufficient to classify them as not applied).
- `scripts/e2e/actors.mjs` and every shared-runner spec tree: not on `main`; read only through the carrier PR file lists, not opened.
- Docs with stale runtime prose, read but not trusted as current: `isolated-stack-plan.md:3-5` ("the stack does not exist yet"), `publication-gate.md` trigger table (pre-isolated `e2e.yml`), `scripts/local-stack/README.md` ("no supabase start has run"), `db-migrate.yml:108-109` (20260728000000 comment).

### 2.4 Owner deltas through 15:31 UTC (as reported by the owner; re-verified only where section 2.1 says so)

- **E1 / #172 (updated 17:36 to 17:50Z)**: head c1c5e856, tree 15ebf278, chain c1c5e856 -> b0cd546a -> 83879c99 -> 860ae5cd; five reviewed diagnostic/test files, workflow and profile unchanged; owner review 6,041 pure/fake controls. All ten checks green at 17:43Z (PR Checks 41878626018, CI/CD 41878625957, Security 41878625836; re-read by this lane at 17:50Z). Hosted tests ran merge ref c45ac78e, not the branch tree; the local full-suite rc 1 / Canvas load failure stays separate, cause unproven. **Run 10, 41863445023 on 860ae5cd** (16:01 to 16:06Z): failed at E1_OPEN (synchronous fixture read/parse before navigation) before edit/save/reload; browser exit observed by POST, browser-label reads ENOENT; causal ordering and cause unknown; cleanup and sanitized upload passed; not proven sandbox failure, not lesson acceptance. Ten dispatches, all terminal. Profile blob 1a11fef202946bf6eacf9c596e8e5b1309313aa6 (sha256 e15422bb...). **No new attempt approved; each E1 attempt needs a fresh exact-profile, one-run approval naming head, tree and profile blob.**
- **Video (updated 17:47Z)**: #146 is published at 535d33e6 with all ten fresh checks green, still Draft (source/CI tier). Browser, provider and a11y acceptance unrun. Owner unchanged.
- **Gradebook (updated 17:47Z)**: local d6dcb5bb state validator passed 378 classifier and 19 read-fault controls; the S5 adapter r3 short-write delta earlier passed 29 fake-fs checks. PR134 owns the combined state/pre-existing-file composition being finalized. Writer exception, publication and runtime held.
- **Quiz**: c80f150 (temp-root fix) is already integrated in #156 as 59f45f2. Nothing to duplicate.
- **Catalog**: no change since #157 fceb2cca; the required 768 px tablet acceptance remains unrun.
- **#147**: existing owner retains the task; the backend-image download denial stands; no alternate registry or route is proposed by this plan.

### 2.3 Evidence tiers used below

`SRC` source present on a named head. `UNIT` jsdom/mocked unit test. `CI` exact-head GitHub check green. `SQL` isolated PG15 SQL/API tier on the loopback stack. `BROWSER` authentic rendered Playwright run on the isolated stack with uploaded, hash-manifested evidence. `MERGED` on `main`. `LIVE` observed on the published site against the production backend. `ACCEPTED` whole requirement at required roles and devices with PASS rows. A green wrapper, a skipped lane, a retry, or a synthetic sandbox probe never promotes a tier.

### 2.5 State after the November apply (2026-11-05; supersedes the "not applied" facts above as current state)

**Applied.** The eight November migrations were applied to the live project through `db-migrate.yml`, one file per run, on `main` `c5f8ab61`, between 00:07 and 00:20 UTC: runs 41938935595, 41939209620, 41939420060, 41939614516, 41939798904, 41939990505, 41940189723 and 41940370735, all success. The ledger now ends `20261101000000` to `20261101000600`, then `20261102000000`. The applying session verified each effect in the live catalog before the next dispatch and reported identical row counts before and after (its report; not re-counted here).

**Post-apply identity comparison (this lane, read-only, about 04:25 UTC).** The prep-1 procedure was run after the apply: the live `public` identities were compared with a local PostgreSQL 16 copy built from `scripts/local-stack/schema` plus the same eight files from `main`, applied in order. 1,136 lines on each side (the three `quiz_analytics` grants excluded as in the snapshot). Functions (121), policies (345), RLS flags (120), table grants (376) and triggers (53) match exactly. Function grants differ in 2 lines only: live keeps `service_role` EXECUTE on `pin_quiz_submission_identity()` and `pin_assignment_submission_identity()` because of the live project's default privileges; the migrations revoke from PUBLIC, anon and authenticated only. Both are trigger functions, so this is an environment difference, not a migration difference. `start_quiz_attempt(uuid)` is granted to authenticated and service_role, with anon removed as `20261101000100` intends. The SQL tier for these files (#181, `c48b5713`) passes 212 of 212 on an isolated copy.

**Merged since revision 4.** #141 (quiz lifecycle, 2026-11-04 22:26:54Z), #142, #149, #178, #177, #179, #181, #180 and #169 (which also carries #165's content). `main` is `9ac5dffc` with all eight check kinds green.

**Closed unmerged.** #170, #161, #150 and #148 (11:38Z, at the owner's direction), and #165 (nothing left to merge; its head is an ancestor of `main`).

**Still open (16 at 11:45Z).** Carriers #155, #157, #166 and #167 need re-composing on the runner base R0 before they can merge, because they carry an older #141 commit (merged into today's `main` they give a duplicate `retryRefusedStart` and an `e2e.yml` clash). #162 and #173 stay held (secrets and runner security; after #172). #172 stays with its owner. #182 is a draft stacked on its own base. #164 needs the owner's call on its reserved migration. #152 and #154 wait for R0. #153 and #140 are soft-close candidates. #183 (tracker reconciliation of WP-02 to WP-05), #184 and #185 are the owner's. #186 is the read-only token for `db-migrate.yml`.

**Served UI.** Not re-read in this revision. The T-08 quiz-start fix is source on `main` since #141; learners get it only from a Lovable publish made after 2026-11-04 22:26:54Z. The owner reports publishing at about 11:48 UTC on 2026-11-05, after that merge (owner-reported; the served bundle was not re-read from this session). T-08 still needs a signed-in quiz start on the live site to count as accepted.

**Remaining before any future apply.** #186 (read-only token) and, as an owner setting, a protected GitHub environment with a required reviewer for the apply job.

No WP is accepted by this revision. Nothing in it authorizes a run, apply, merge or publish.

### 2.6 Live student quiz-start check on the published site (2026-11-06 23:42 to 23:53 UTC)

**Question.** Can a student start a quiz on the published site against the live database after the November apply and the publish that carries #141?

**Setup.** Owner-directed. A cloud session on the owner's "Supabase + IC" environment (which holds the student test-account credentials) ran a standalone Playwright script against `https://insightscollective.org` with the container's Chromium through the session proxy. Scope limits: sign in as the existing student test account, open one quiz in the learner player, give the first answer (the inline player creates the attempt through `start_quiz_attempt` on the first answer), do not submit, create no accounts, change no passwords, commit and post nothing. Target: course "Introduction to Data Science", module 1, quiz "Foundations Quiz" (3 attempts allowed, none used by the account). Served index at 21:32 UTC claimed commit e073adc; the served chunk `CourseLearn-Dm2zr5me.js` carried #141's player strings.

**Run 1 (23:44 to 23:47 UTC): blocked before any attempt.** The student onboarding tour dialog intercepted the first-answer click; `start_quiz_attempt` was never called. Live readback afterwards: attempts 2, progressions 13, certificates 1 (baseline unchanged); `last_sign_in_at` 23:45:51 UTC shows the sign-in itself succeeded. The repo's own switch for this is `SpotlightTour`, which returns early when `localStorage` holds `e2e:disable-tours`.

**Run 2 (23:51:59 to 23:52:13 UTC): attempt started.** With that key set before navigation, the player reached `quiz-player-active`, the first option click went through, and `POST /rest/v1/rpc/start_quiz_attempt` answered **200** with the new attempt row: quiz `fdfd1c71-789d-4271-8300-7d45dbf6ee6d`, attempt 1, `started_at` 2026-11-06T23:52:10.342559Z, submission id `092b42cb-850d-4e34-be09-b615c22664ef`. The second screenshot shows "Attempt 1 of 3, Time remaining 29:58, Saving..." with the first option selected. No console errors. No `POST /rest/v1/quiz_submissions` (the pre-#141 direct insert) was made. The non-GET requests seen were the app's role-check RPCs (`get_user_roles`, `has_admin_access`, `is_course_instructor`) and one `POST /rest/v1/quiz_submission_answers`, the answer save for the attempt that had just been created; the script's blanket "any non-GET" filter labelled these as unexpected, which is a filter defect, not a product one.

**Live readback (this lane, read-only, 23:55 UTC).** Test account: attempts 3 (was 2), the new row on quiz fdfd1c71 with `attempt = 1`, state `pending_review`, `finished_at` null, started 23:52:10; progressions 13 (unchanged); certificates 1 (unchanged); `last_sign_in_at` 23:52:05 UTC.

**Verdict.** PASS for the question asked: a student can start a quiz on the published site; the attempt is created through the RPC and nothing else in live data changed beyond that attempt and its first saved answer. This is one journey, one role, desktop 1440x900, one quiz; it is not the 18-case lifecycle acceptance, not Edge scoring, and not a device matrix.

**Evidence held.** Screenshots `01-before-quiz-loaded.png`, `01b-after-dismissing-tours.png`, `02-after-first-answer.png`, `summary.json` and the Playwright `trace.zip` from run 2 were delivered to the owner from the running session; the RPC response body and the readback above are the durable record here. The attempt was left unsubmitted on purpose.

**Answer save read-back (2026-11-07 14:50 UTC, read-only).** The owner approved the answer save at 14:39 UTC on condition that it is the student test account's own answer and no real student's. No new write was needed or made: run 2's one `POST /rest/v1/quiz_submission_answers` is that save, made by the seeded e2e student test account and no other. Live read of attempt row `a083bbae-eaa6-4931-b224-447bd3bae129` (submission id `092b42cb`, quiz fdfd1c71, attempt 1, `workflow_state` `pending_review`, `finished_at` null): exactly one answer row, `c49b7459-c99a-47fd-ae98-3d80b7513a43`, question `c5676e2d` (position 0, "Which of the following best describes data science?"), `answer_data` `{"answer": "a"}`, created 2026-11-06 23:52:12.699 UTC, never updated since. `a` is the first option, which matches the screenshot of the first option selected. The row reads `correct = false`, `points = 0` although `a` is the keyed answer; that is by design, because the `pin_quiz_answer_grading` trigger (migration 20260728000000) pins both fields on any insert by a non-staff user, so grading only happens at submit. Verdict: PASS, the answer saved under the right attempt and question and reads back exactly as given. The attempt stays unsubmitted; nothing was graded, submitted or deleted.

## 3. Ownership and collision map

### 3.1 Reserved owners (unchanged; this plan edits none of their files)

| Owner (thread) | Reserved scope | PRs / refs |
|---|---|---|
| PR134 coordinator (shared integration, security, lesson E1) | `.github/workflows/e2e.yml`, `security.yml`, `test.yml`, `.github/codeql/codeql-config.yml`, `scripts/ci/*`, `scripts/e2e/*`, `scripts/local-stack/*`, `scripts/gradebook-fixture/*`, `e2e/gradebook-roles/*`, `e2e/quiz-lifecycle/*`, `e2e/lesson-editor/*`, `playwright.*.config.ts`, all `supabase/migrations/2026110*`, db-migrate dispatch | #172, #170, #154, #161, #152 composition, #142 merge order, #149, #136/#140 T-09 |
| Catalog | `src/pages/CourseList.tsx`, `CourseDetail.tsx`, `src/components/common/CourseCard.tsx`, `src/components/home/FeaturedCourses.tsx`, `src/lib/catalogCategory.ts`, `src/lib/estimatedTime.ts`, `e2e/public-catalog/*` (as carried by #157) | #145, #150, #157 |
| Video | `src/components/course/video/*`, `src/components/ui/extensions/video-extension.ts`, `src/services/videoAnalyticsService.ts`, `scripts/e2e/le-lane/*` video split, `20261104010000` (reserved, unapplied) | #146, #164, #173 |
| Gradebook | `src/lib/assignmentGrading.ts`, `src/pages/CanvasGradingInterface.tsx`, `src/pages/CourseGradebook.tsx`, `src/components/course/canvas/CanvasAssignmentsList.tsx`, `src/components/course/learn/InlineAssignmentSubmit.tsx`, `src/types/canvas.ts`, storage S0..S5 lane | #139, #148, #156, #162 |
| Quiz | `src/components/course/learn/InlineQuizPlayer.tsx`, `LessonViewer.tsx`, `src/utils/quizAttemptPolicy.ts`, quiz fixture, T-62 declaration | #141, #153, #155 |
| Students/Reports (merged source) | `StudentsView`, `ReportsView`, `courseReportService`, roster/Reports acceptance carrier | #163 (merged), #167 |
| Builder / copy | `src/pages/CourseBuilder.tsx`, `src/services/canvasContentService.ts`, `src/components/course/builder/*` | #165, #169, #166, issue #168 |
| Navigation (#147) | `src/pages/EnrolledCoursesDashboard.tsx` | #147 |
| Frozen | #134, #143 refs (legacy production-connected `e2e.yml`); never push, reopen or dispatch | #134, #143 |

### 3.2 File collisions measured from the complete PR file lists (REST, paginated to the empty page, 15:35Z)

Complete counts: #172 280 files, #166 280, #170 259, #167 250, #162 224, #157 82, #173 21; product PRs 2 to 20 each.

- **Shared runner tree, five full carriers plus #157**: 222 files are common to all of #162, #166, #167, #170 and #172 (148 under `scripts/`, 28 under `e2e/`, 30 `src/` tests, 10 product `src/` files, `.github/workflows/{e2e,security,test}.yml`, `codeql-config.yml`, `playwright.gradebook-roles.config.ts`, `playwright.quiz-lifecycle.config.ts`). #157 shares `e2e.yml` and four `src/test/ci/*` checks with them. These are compositions of one runner, not five runners. **Only one can be the next `e2e.yml` on `main`; every other must be re-composed on top of it by its own owner.** What each carrier adds beyond the common set: #162 only two storage diagnostic scripts; #167 the `e2e/roster-reports/**` lane (11 files incl. `actors.mjs`), its fixture manifest and `nightly.yml`; #166 the `e2e/builder-authoring/**` lane (12 files) plus builder product blobs; #172 the `le-iso/**` seccomp and lane scripts (21 files); #170 adds nothing unique (superseded).
- **Carriers carry product blobs.** Every carrier includes the product source of #139 (gradebook, 6 files) and #141 (quiz player, 4 files) and `src/pages/CourseLearn.tsx` from #149's collision set; #166, #170 and #172 also include #142's persistence files; #166 includes #165 and #169's builder files. **Merging any carrier would merge those product PRs by composition and bypass their source merge order.** Carriers are therefore run vehicles, not merge candidates, until each product PR has merged on its own.
- Merge order is a coordinator decision. This plan's R0 is a proposal only: it names #172's line (newest reviewed seccomp profile, E1 lane, 860ae5cd) as the likely base and #167 as the first candidate to be re-composed because its unique files are its own lane. It does not authorize re-basing any branch; each owner re-composes its own carrier when the coordinator confirms the base.
- **#173 vs #172**: `scripts/e2e/le-lane/{bridge,image,run-lane}.mjs`, `codeql-config.yml`, `security.yml`, `playwright.config.ts`. #173's `e2e.yml` is byte-identical to the composition's #172 copy (handoff), so #173 adds no dispatch route; it cannot be read as mergeable before #172 and #146.
- **Lesson-editor lane**: `e2e/lesson-editor/*`, `scripts/e2e/le-e1-summary.mjs`, `le-owned-procs.mjs` shared by #170 and #172; #170 is the superseded composition (handoff: "old lesson-editor lane is superseded by PR134"). Treat #170 as history; do not dispatch it.
- **Product collisions**:
  - `src/pages/CourseBuilder.tsx` and `src/services/canvasContentService.ts`: #142, #165, #169 (stack order #142 then #165 then #169; #169 already carries #142/#165 ancestry).
  - `src/components/course/builder/{LessonEditorPane.tsx, lessonSaveQueue.ts, teachable/LessonEditView.tsx}`: #142 and #169.
  - `src/components/course/builder/{courseCreation.ts, reorderReconcile.ts}`: #165 and #169.
  - `src/pages/CourseLearn.tsx` and `CourseLearn.assessmentNavLabel.test.tsx`: #141 (quiz) and #149 (T-10 read model). Coordinator must choose order; the quiz owner's blob is the product owner for the player, #149 for the progress header.
  - `src/components/course/video/embedSource.ts` and its test: #146 and #164 (tracker: #164's blob equals #146's; order #146 then #164).
  - `src/services/__tests__/canvasContentService.test.ts`: #157, #165, #169 (catalog touches it only for its own fixture; must be re-based after the builder stack).
- **No open PR touches `supabase/`** (complete file lists). The seven `20261101*` T-09 files, `20261102000000` (#159) and the reserved `20261104010000` are on `main` or reserved, not recorded in the ledger. Upgrade compatibility is therefore a ledger-and-effective-state question, not a merge conflict.

### 3.3 Instruction to the acceptance lane

The acceptance lane owns **no product file and no shared-runner file**. Its only artefacts are: this plan, a tracker update (coordinator-applied, in place, r7.41+), acceptance case specs that already exist in owner carriers, and run receipts. Any new spec needed for a gap below is proposed to the owner of the collision group, never added to a sixth copy of `e2e.yml`.

## 4. Requirement to source to evidence matrix

Columns: requirement (tracker ID); current source head; best real evidence and its tier; the gap to ACCEPTED; owner. "Real" means the newest run on the exact head, not an older composition.

### 4.1 Permissions and privacy (WP-02, T-05, T-31, T-55)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| Instructor reads scoped to own courses on progressions, quiz submissions, quiz answers (T-05) | `main` carries `20261101000000_scope_instructor_reads_to_own_courses.sql` (#135 merged) | SQL 54/54 local; **not applied live** (ledger) | Authentic PostgREST persona proof (student A/B, instructor A/B incl. self-enrolled unrelated instructor, co-instructor, admin, anon) on the isolated stack with the migration applied; then an approved `db-migrate.yml` apply with ledger verification | PR134 |
| `start_quiz_attempt` requires quiz access (T-31) | `20261101000100` on `main` | SQL 10/10 local; T-09 API tier 48 controls PASS (run 41326047027 on c64a8fc, older head) | Same persona proof on current `main`; live apply | PR134 / quiz |
| Narrow reads (#159: career_quiz_attempts, user_feedback, blog_settings) | `20261102000000` MERGED | SQL run 41491111217 SUCCESS (#161, 601bf915); ledger does not record the version; **effective live policy text unverified** (the Nov 3 17:54Z read is the last observation) | Read-only `pg_policies` comparison first; then live apply (explicit grant) and a second read | PR134 |
| Reorder RPCs SECURITY DEFINER without caller check (T-55) | `20260412000000` live; no fix PR | SRC gap only | Isolated metadata/role proof, then a migration proposal (new version, never reused) | PR134 |
| UI course filters are not authorization | all instructor pages | none | Every instructor/admin journey below must include a foreign-instructor direct-API negative | acceptance lane proposes, owners carry |

### 4.2 Catalog (WP-14, T-25, T-60, A7)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| Public catalog, detail, filters (category/level/estimated_hours), URL state, published-only, 1440/768/390 | #145 6f61532b (SRC+CI); #157 fceb2cca carries A4/A8 diagnostics, 768 mapping, cleanup-reporter fix (stacked CI only) | Run 41443451742 on old head 89bd3c57: 26 pass / 5 fail (A8 at three sizes, A4 keyboard desktop+tablet), 0 PNG | One authentic run of #157's job on fceb2cca re-composed onto the confirmed runner base, with the sandbox preserved (no default no-sandbox route), real PNGs by fixed name, pairing-control temp-dir cleanup proven; **768x1024 tablet acceptance is required** (the job's 834x1112 capture, if kept, is additional, not a substitute); A4/A8 must pass at 768 or be diagnosed to a product defect with a separate PR. A 768 source mapping is not a 768 runtime pass. | Catalog |
| Theme presets (Classic/Focus/Workshop, accent) have a meaningful learner consumer (T-25) | none; `CourseDesignView` saves `settings.theme`, no learner reader | SRC gap | **Retained requirement.** Needs an implementation owner and then a save -> reload -> visible learner effect case at three sizes; the only decision is the consumer contract (which surfaces, which tokens) | unassigned (implementation owner needed) |

### 4.3 Lesson save/reload and publishing (WP-04, T-11, T-12, T-52, T-53, T-57)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| Lesson save, reload, selection change, unmount flush, failed write not reported saved (T-52) | #142 5b3fdce7 (SRC+UNIT+CI); diagnostics now on #172 c1c5e856 (tree 15ebf278), ten checks green 17:43Z | E1 save/reload case PASS per summary on #170 3f6d2afd run 41700355409 (job RED on CAPS_PRE, no artifact); run 9 (41839316072, a134131d) reached browser launch/attestation, PRE AppArmor ENFORCE, Chromium connection and the test-scoped fixture, then POST `APPARMOR_E_UNKNOWN`; run 10 (41863445023, 860ae5cd) failed at E1_OPEN before edit/save/reload, browser exit observed, label reads ENOENT, cause unknown; both cleanups passed; neither is E1 acceptance | Source/CI: c1c5e856 is reviewed and green. Runtime: **one fresh exact-profile, one-run approval** (head c1c5e856, tree 15ebf278, profile blob 1a11fef2... sha256 e15422bb...) for any next attempt, none approved now; an attempt that uploads evidence with a determinable UI phase; then the remaining 16 #152 cases | PR134 |
| Deep link `?lesson=` and type edits (T-53) | #142 | UNIT | included in #152's 17 cases | PR134 |
| Admin publish bypasses readiness, zero-row writes (T-11) | `useCoursesManagement.ts` unchanged; no PR | SRC gap | Product repair PR (admin publish shares the builder readiness/readback contract), then publish journey run | unassigned (coordinator to assign; not the persistence owner silently) |
| draft -> publish -> catalog -> enroll/learn -> unpublish -> rollback at three sizes, instructor vs public comparison | spread across builder, catalog, learner | no run covers the chain | New journey case set (section 6, R5) carried by #166's builder job or a successor | Builder + catalog |

### 4.4 Quiz (WP-10, T-08, T-62, G4)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| RPC-only start, no direct INSERT, resume, retake, finalization readback; failed start leaves no rows and no phantom Submit | #141 fa92771d (SRC+UNIT+CI) | 7/7 no-Edge cases PASS, run 41375114821 on 442ba06d (F2, F5, R3, T62 at 1440/768/390, allowed start) | 11 remaining lifecycle cases of the 18-case spec; T-62 "honest controls on a confirmed refused start" still open by source; real `score-quiz` Edge scoring (G4) never run | Quiz |
| Temp-root fix c80f150 | already integrated in #156 d5646387 as 59f45f2 (owner delta 15:31Z) | SRC | nothing separate; do not duplicate; re-pin when the runner base changes | Quiz / PR134 |

### 4.5 Gradebook, grading, CSV (WP-05, T-13, T-14, T-61)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| `assignments.points` denominator; grade save counts only on full readback; 0 is a grade | #139 caa6fb7b (SRC+UNIT+CI) | UNIT only | Journey J0..J4 in `e2e/gradebook-roles/journey/*` carried by #162 | Gradebook |
| Storage S0..S4, private runner input, N1 owner delete | #162 a6d1d636; local S5 adapter r3 (short-write delta passed 29 independent fake-fs checks, owner delta 15:31Z) unpushed | Run 41622511658 RED at S4 N1 (42501 from storage `protect_delete` trigger, association not identity) | Final composition identity, writer-policy exception decision, combined-workspace ancestry proof; one approved run; no service role, no trigger disable, no policy widening | Gradebook |
| Exact attempt selection, zero vs missing, pending, late, feedback readback, real CSV bytes with independent parser, formula neutralization, Chromium and Firefox | `gradebookData.ts`, `CourseGradebook.tsx` | UNIT (CSV rows) | Browser download capture + independent parse case; Firefox project exists in `playwright.config.ts` but every isolated job runs Chromium only; mobile Safari explicitly BLOCKED on hosted Linux runners | Gradebook |
| Attachment path vs signed-URL divergence (T-13) | unchanged | SRC gap | Product PR + S-lane case | Gradebook |

### 4.6 Roster and Reports (WP-06, WP-07, T-15, T-16, T-17)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| Roster/Reports metrics from `content_item_progressions`; 11 scoped cases | #163 MERGED; carrier #167 6e5e5126 | 11/11 PASS run 41638843467 on older head 874d5fe5; nightly repair 6e5e5126 CI green, no new run | Re-run of the 11 cases on 6e5e5126 after re-base onto the runner base (receipt must name 6e5e5126's tree); then the whole-WP set: all sort modes, search, attention boundary, empty/error/retry, pagination, 390 px, foreign-instructor denial, learner drill-down links, cache invalidation after role/course change | Students/Reports |
| `course_roster_stats` RPC rebuild (Manage Courses avg) | not done | SRC gap | Migration (new version) + SQL tier + Reports case | PR134 (schema) with Students/Reports |
| LIVE: served index claims `main` 82a97196 | marker only; bundle and function identity unverified | LIVE marker, not deployment proof | Identity verification first (section 7 item 1); then a read-only post-publish smoke of /courses/:id?view=students and Reports as instructor, co-instructor, foreign instructor, student, at 1440/768/390 | acceptance lane (read-only accounts; see permissions) |

### 4.7 Video (WP-09, T-20)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| Accessible read-only YouTube/Vimeo embed, honest load/slow/unsupported states | #146 3e2d3b5f (SRC+UNIT+CI, composes cleanly with `main`) | UNIT (jsdom, no provider network) | Real provider playback, captions, keyboard, fullscreen, orientation at three sizes; private/removed video behaviour; author preview | Video |
| Source-only sealed video lane and #146 | #146 published at 535d33e6, ten fresh checks green, Draft (owner, 17:47Z); #173 04f05811 (stacked, 1 check) | SRC+CI for #146; 24 browser cases listed on #173, not run; earlier full-suite exit 1 (CanvasGradingInterface load) and typecheck TS2769 on the older carrier head stay recorded | Base/head decision for #173; runtime wiring is a separate reviewed change. Browser, provider and a11y acceptance unrun. | Video + PR134 |
| Watch-progress producer, resume, idempotent batches | #164 c5b7caf8 (unwired); R3 a05df983 local | UNIT; integration BLOCKED on duplicate-apply risk | Durable dedup or reconciliation contract; isolated SQL on `20261104010000` (reserved) before any wiring | Video |

### 4.8 Progress, completion, certificates (WP-03, WP-12, T-06..T-10, T-23)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| One stored-progress read model; graded counted consistently; loading/error not shown as 0 | #149 ea413633 (SRC+UNIT+CI) | none in browser | G3: browser run with the six-item deterministic oracle (tracker T10-RM) at three sizes | PR134 |
| Started-only quiz must not complete (T-09); Next/scroll must not complete assessed content | `20261101*` on `main`, unapplied | T-09 API tier PASS on c64a8fc (older) | Re-run T-09 harness on current `main` tree; G4 Edge scoring; live apply | PR134 |
| Certificate eligibility -> single issuance -> PDF -> verifier parity; functional customization for new certificates; every valid historical certificate readable and unchanged (T-23) | source has display, verifier, two PDF paths; `settings.certificate` saved but unconsumed; `enabled=false` does not stop auto-issue | SRC inventory only; `check_course_completion` anon-callable (historical) | **Retained requirement**: customization must affect new artifacts (preview, PDF, issued screen, verifier agree) with versioned templates so old artifacts render as issued. Journey J4 (`j4-learner-readback-certificate.spec.ts`) exists in the shared runner tree. Needs an implementation owner; the open choices are the versioning contract and the anon-grant disposition, not whether to do it | unassigned (implementation owner needed) |
| Historical anomaly report delivered privately | unknown | none | Confirm delivery; never in a public PR | root |

### 4.9 Authoring, wizard, copy (WP-08, T-18, T-19, T-54, T-56, T-58)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| Section/lesson reorder with rollback, dense order, protected delete | #165 c364f71d | BA-R1S PASS desktop only; BA-R1 rapid FAIL (issue #168) | #168 closes only on an unchanged rapid-input pass or a recorded product decision; 768/390 reorder never run | Builder |
| Resumable creation (T-56) | #165 | UNIT | C1/D1/D2 PASS on run 41617663029; reload durability and auth backend proof open | Builder |
| Copy-from-course (T-18), no student data copied | #169 c9f69850 | UNIT; K1 UNRUN | K1 run in #166; denied-copier negative | Builder |
| Real bulk import | the misleading no-op control is removed by #169; the original requirement stands | none | **Retained requirement**: a real import contract (formats, file checks, preview/dry run, collision handling, recovery, no student data) with its own owner and acceptance cases; #169's removal of the false affordance is honest but does not deliver it | unassigned (implementation owner needed) |
| Self-service vs instructor-only creation, co-instructor mutation, unpublish access (T-19, T-58) | policy | none | decisions before encoding tests | owner decision |

### 4.10 Navigation and search (WP-01, #147)

| Requirement | Source | Evidence | Gap | Owner |
|---|---|---|---|---|
| Enrolled search no-match + Clear; Notifications link to `/notifications` only when visible; no hidden writes | #147 9377b8c9 (SRC+UNIT+CI; read-only page assertion in tests) | none authentic: the existing task stopped at a policy-denied backend image download before fixtures or browser | Three-viewport signed-in acceptance remains with the **existing #147 owner**; the backend-image denial stands as recorded; this plan proposes no alternate registry, route or re-homing. Whether the shared isolated job can host the #147 cases is the coordinator's and that owner's call, not this lane's | existing #147 task |

### 4.11 Non-LMS regression (WP-17)

Career, resources, blog, events, portfolio, interview, AI assistants, admin users/forms/email log/page visibility: no LMS PR touches them (file lists), but `AppSidebar.tsx` (#157), `pageManifest`/VisibilityGate and the dependency set do. Minimum: the existing `e2e/` non-LMS specs listed by the test inventory (section 4.12) run once on the release candidate tree, signed-out and signed-in, desktop only unless a spec already declares other projects. This is a smoke, not an audit; the full non-LMS audit stays unsized discovery.

### 4.12 Existing evidence producers on `main` (read-only inventory, HEAD 82a97196)

- **Vitest**: 189 files, all against the global Supabase mock (`src/test/setup.ts:137`, `src/test/mocks/supabase.ts`); `.rpc()` names validated against `src/test/fixtures/db-functions.json`. Tier UNIT only, never backend proof. Five Deno tests under `supabase/functions/` run in `pr-checks.yml`.
- **Playwright**: 123 specs under `e2e/`. Projects in `playwright.config.ts`: `chromium-member` (default), `chromium-member-journeys`, `chromium-admin`, `chromium-instructor`, `chromium-public`, `firefox` (dashboard and course-list only), `visual` (1280x800). **No tablet or mobile project exists**; 768/390 widths are set inside individual specs (`auth/mobile-overflow-signed-out`, `layout/mobile-overflow`, `landing/mobile-text-overlap`, `instructor/announcements-mobile-layout`, `journeys/notifications-flow`, `journeys/profile-certificates-flow`, `dashboard/dashboard`, `evidence/frontend-evidence`). WebKit is commented out; mobile Safari is BLOCKED on hosted runners by construction.
- **Wired to the isolated stack on `main`**: only `courses/course-list`, `courses/course-detail`, `evidence/frontend-evidence` (the `readonly-courses` selection). Every other spec was written for the old hosted suite; at least 13 hard-code the production project ref (10 journeys via `journeys/_helpers/signIn.ts`, `admin/admin-certificates`, `admin-completion-report`, `admin-instructor-roster`, `assignments/feedback-notifications`, `courses/course-calendar-sync`, `instructor/student-insights-instructor`, `career/bls-wages-api`, `interview-prep-design/code-evaluation`, `interview-prep/mock-interview-booking`, `navigation/live-visibility-config`). The guard refuses them on an isolated run; they must not be pointed at production to "make them run".
- **Skips**: no `fixme`/`only`/unconditional skip, but most signed-in specs skip on a missing session or missing data. A skip is not a pass (lessons-learned 02:150). Every acceptance receipt must list executed, skipped and failed by name.
- **Visual baselines**: 3 PNGs under `e2e/visual/visual-regression.spec.ts-snapshots/` from the hosted era (last touched 2026-08-14); never captured on an isolated stack; relay mode blocks fonts, so never refreshed from a relay run.
- **Guards**: `scripts/e2e/assert-safe-target.mjs --mutating` (fail-closed, no opt-in), `scripts/local-db/assert-local-dsn.mjs`, `scripts/ci/check-local-target.mjs {env,dist}`, `scripts/ci/check-isolated-workflow.mjs`. Global setup's fallback URL is the production ref; the guard is the only thing that stops it.
- **Production-default tooling that must not be run by this lane**: `npm run audit:{types,invariants,queries,fixtures,functions}` (live DB as admin, no guard), `smoke:functions[:authed]` (no default, no guard), `scripts/reconcile/*.sql` and `scripts/reconcile_migration_ledger.sql` (production ledger writes).
- **Shared-runner trees not on `main`**: `e2e/gradebook-roles/**`, `e2e/quiz-lifecycle/**`, `e2e/lesson-editor/**`, `e2e/public-catalog/**`, `e2e/builder-authoring/**`, `scripts/e2e/actors.mjs`, `scripts/gradebook-fixture/**`, `scripts/local-stack/learner-quiz/**` exist only on the carrier PRs (section 3.2).

### 4.13 Role by device coverage grid (what has BROWSER-tier evidence today)

Legend: P = passed on the isolated stack at that size; F = ran and failed; U = unrun; n/a = no such screen. Roles: Pub (anonymous), Stu (student A), Stu-B (second student), Ins (owner instructor), Co (co-instructor via `course_assignments`), For (unrelated instructor), Adm (admin).

| Journey | 1440 | 768 | 390 | Roles with any evidence | Roles with none |
|---|---|---|---|---|---|
| Catalog list and detail (read) | P (#137/#138, 41443451742 subset) | P | P | Pub, Stu (member) | Ins, Co, For, Adm |
| Member denial of /admin | P | P | P | Stu | others |
| Enrolled search/notifications (#147) | U | U | U | none | all |
| Lesson editor save/reload (E1) | P-by-summary only (41700355409, no artifact) | U | U | Ins | Co, For, Adm, Stu negative |
| Builder reorder/delete/resume/copy | P desktop (R1S, R2, C1, D1, D2); F (BA-R1) | U | U | Ins | Co, For, denied copier |
| Publish chain | U | U | U | none | all |
| Quiz 7-case no-Edge slice | P | P | P | Stu, refused actor | Stu-B, Ins preview, Edge scoring |
| Quiz remaining 11 + Edge | U | U | U | none | all |
| Gradebook / grading / CSV | F (S4 N1) | U | U | Ins, Stu (fixture) | Co, For, Adm; Firefox U |
| Roster / Reports 11 cases | P (874d5fe5) | P | P | Ins, Stu, For (as the cases declare) | Co, Adm; new head 6e5e5126 U |
| Video playback | U | U | U | none | all |
| Progress read model (G3) | U | U | U | none | all |
| Certificate issuance / verifier (J4) | U | U | U | none | all |
| Live site (post-publish) | P desktop a11y names only (1188x761, #151) | U | U | Pub | all signed-in |

Real workflow criteria for a row to turn P: exact head and tree in the receipt; synthetic actors named by role; the action, the backend readback (API or SQL) and the rendered screenshot captured for the same request; a negative control in the same run (foreign actor or refused write); viewport declared by the spec, not by a project default; executed/skipped/failed counts by case name; cleanup and process-absence receipts; artifact hash manifest. A PASS line without an uploaded artifact (as in 41700355409) stays "P-by-summary" and does not count toward ACCEPTED.

### 4.14 Source-derived candidate defects to reproduce as acceptance cases (not fixes)

Found while mapping source; each is a negative or consistency case for the owner's carrier. None is claimed as a live defect until a run shows it.

| # | Candidate | Source | Proposed case and owner |
|---|---|---|---|
| C1 | Two co-instructor tables: `is_course_instructor` reads `course_assignments`; the admin page `/courses/:id/instructors` writes `course_instructors`; adding a co-instructor there may grant neither `canEdit` nor RLS access | `src/pages/CourseInstructors.tsx`, `CourseInstructorsTab.tsx`, snapshot `03_functions.sql:1484` | Co role row in every instructor journey must be created through the real UI path and then exercised; if it fails, that is the Co-role defect for WP-02/WP-15 |
| C2 | Builder writes `modules.position` (reorder RPC) but `CourseDetail` orders modules by `week` | `canvasContentService.ts:255`, `CourseDetail.tsx` | Reorder in builder, then compare learner/detail order after reload (R5 and R9) |
| C3 | `enrollments` INSERT policy checks only `auth.uid() = user_id`; no DB guard against enrolling in an unpublished course | snapshot `04_rls_policies.sql` | Direct-API negative in the publish chain (R9): student enrolls in a draft course by API |
| C4 | Assignment uploads route by MIME to `course-images`/`course-videos`, while grader and bulk download read only `course-documents` | `useFileUpload.ts`, `SubmissionAttachments.tsx`, `submissionBulkDownloadService.ts` | Gradebook S-lane: submit an image attachment, then open it as instructor (R4) |
| C5 | `settings.certificate.enabled=false` does not stop `auto_issue_certificate_on_progression`; learners can delete their own certificate | `CourseCertificatesView.tsx:54-67`, certificates RLS | Certificate journey (R10) negatives; product decision on opt-out |
| C6 | `StudentInsights` checks the global instructor role, not course scope (T-28) | `StudentInsights.tsx:21-25` | For role opens `/courses/:id/insights/:studentId` (R2 extension) |
| C7 | `InlineQuizPlayer` on `main` still inserts `quiz_submissions` directly (no INSERT policy); #141 replaces it | `InlineQuizPlayer.tsx:227` | Already T-08/T-62; confirms the live site at 82a97196 serves the defective player until #141 merges and publishes |
| C8 | `UnifiedExportReport` compares numeric `completion_status` to the string `'completed'` | `UnifiedExportReport.tsx:130` | Admin export case (WP-15, unassigned) |
| C9 | Reorder RPC authorization (T-55); fix in draft #202, not applied | #202 | Direct-API negative as For and as anon (R5) |
| C10 | `video_analytics` instructor policy may give dual-role users global read | `20251006_video_analytics_and_discussions.sql:280-290` | SQL-tier persona case when #164's contract is reviewed |
| C11 | The master plan sets legitimate assessed submission as the completion minimum; `20261101000200` encodes "complete attempt only" for quizzes. What is still undefined is the exact business contract for grading and passing thresholds and for latest/highest/kept scoring | `completion-policy-trace.md`, migration header | Owner records the exact contract before the live apply; no run in this plan changes any historical achievement |
| C12 | `db-migrate.yml` has no `permissions:` block and no `environment:` protection; ALL mode bypasses `apply-atomic.sh`; the 20260728000000 comment is stale | workflow lines 104-121, 161-166, 238-240 | Release checklist item; single-file mode only; no ALL/RECONCILE in this release |

## 5. Exact acceptance gaps (ranked by what blocks the most)

1. **Shared runner base not chosen.** Six carriers rewrite `e2e.yml`; no composition is the agreed next `main` workflow. Until the coordinator names the base, every "re-run on current head" below is blocked. Evidence: section 3.2.
2. **E1 sealed lane has not yet produced a determinable UI phase.** Run 9 (41839316072) reached browser launch, PRE AppArmor ENFORCE, Chromium connection and the test-scoped fixture, then POST `APPARMOR_E_UNKNOWN`; run 10 (41863445023 on 860ae5cd) failed at E1_OPEN before edit/save/reload with the browser exit observed and label reads ENOENT, cause unknown; earlier runs failed at AppArmor evidence and CAPS_PRE. No run has uploaded evidence that an E1 UI action completed. Ten dispatches consumed. Evidence: jobs 126606365642 and 126691319950 steps 37 and 40 plus the owner's receipts.
3. **Backend contract verifiably not live.** Ledger and catalog agree at 17:20Z that none of the November migrations is effective, while the served bundle contains `main`-era UI (#163 present, #147 absent). Any LIVE acceptance of completion, quiz start authorization, narrow reads or scoped instructor reads is testing the OLD backend with NEW UI. Byte identity of the served bundle is still unproven.
4. **Catalog A4/A8**: five historical failures with zero PNGs; new source never run.
5. **Gradebook N1**: no passing grading journey; storage delete refused by the API trigger.
6. **Quiz**: 11 of 18 lifecycle cases and all Edge scoring unrun; T-62 honest-controls open.
7. **Video**: nothing beyond jsdom; typecheck TS2769 and a full-suite exit 1 on the carrier.
8. **Certificates and completion**: no owner; J4 spec exists but is unrun; copy contract undecided.
9. **Role negatives**: no journey yet includes the foreign-instructor direct-API denial required by WP-02 for every instructor surface.
10. **Device coverage**: only catalog/detail/denial (#137/#138), the 7 quiz cases and the 11 roster cases ran at 768 and 390. Everything else is desktop-only or unrun. Firefox and mobile Safari: no isolated job runs them.

## 6. Smallest safe dependency order and proposed bounded runs

Each run: exact head and tree recorded, isolated loopback stack only (`scripts/e2e/assert-safe-target.mjs --mutating` and `check-local-target.mjs` before any write), synthetic actors only, no secret, no production ref, cleanup and process-absence receipts separate, sanitized upload with sha256 manifest, one dispatch per approval, no automatic retry. Each needs a fresh action-specific approval from the owner (T) and, where noted, a user environment approval. All dispatches go through `actions_run_trigger` on the branch that carries the job, never on `main`'s `readonly-courses`.

| # | Run | Prerequisite | Head / job | Roles and devices | Pass criteria | Cleanup and receipts | Permission |
|---|---|---|---|---|---|---|---|
| R0 | **Proposal to the coordinator, not authority**: confirm the runner base (likely #172 line at 860ae5cd); then each owner re-composes its own carrier (#167, #157, #162, #166) when it is next needed, one at a time, with product blobs byte-identical to the product PR heads | none | source only, per owner | n/a | each re-composed head keeps its product blobs byte-identical; 10/10 checks; `check-isolated-workflow.mjs --executed` passes | n/a | coordinator decision; no blanket re-base; no run |
| R1 | Next E1 attempt on #172 c1c5e856 (or its reviewed successor) | ten checks green (done 17:43Z); coordinator qualification of the exact head; owner's E1_OPEN diagnosis from run 10 | #172, job "Lesson-editor E1" | instructor owner at 1440 (E1 is single-case) | the lane reports a determinable UI phase past E1_OPEN; an E1 save/reload PASS line with uploaded evidence; bounded `REPORTED_ERROR` only; no raw export | existing lane gates; artifact uploaded after teardown | **fresh exact-profile, one-run approval** naming head c1c5e856, tree 15ebf278 and profile blob 1a11fef202946bf6eacf9c596e8e5b1309313aa6; the ten consumed dispatches do not carry over; **none approved now** |
| R2 | Roster/Reports 11 cases on #167 6e5e5126 re-based | R0 | #167 job | instructor, co-instructor, admin, student, foreign instructor; 1440/768/390 as the existing cases declare | 11/11 with receipt naming 6e5e5126's tree; witness unchanged | existing private cleanup | T allowance |
| R3 | Catalog job on #157 fceb2cca re-composed by the catalog owner, sandbox preserved | R0 | #157 job | anonymous + member; 1440x900, **768x1024 (required tablet acceptance)**, 390x844; 834x1112 only as an additional capture if the job keeps it | 31 executed, 2 intended skips, A4 and A8 PASS at 768, real PNGs by fixed name under sha256 manifest, temp-dir cleanup proven | pairing-control cleanup | T allowance |
| R4 | Gradebook S0..S4 (+S5 adapter r3 after review) on #162 successor | R0; exact delta review; writer-policy decision | #162 job, environment `insights-isolated-storage` | instructor, learner, foreign instructor; desktop; Firefox project if the job can bind it, else BLOCKED row | S4 N1 PASS without service role / trigger disable / policy widening; J0..J4 PASS; CSV bytes parsed independently | leak tripwire, private removal | T allowance + user environment approval |
| R5 | Builder K1 copy + BA-R1 rapid retry + 768/390 reorder on #166 re-based | R0; #169 reviewed | #166 job | authorized instructor, denied copier; 1440 for BA, 768/390 added as new cases | K1 PASS, no student data copied; BA-R1 either PASS (closes #168) or FAIL recorded with the same monitor signature | existing | T allowance |
| R6 | Quiz remaining 11 cases, no-Edge first, then the Edge-runtime job (G4) | R0; T-62 follow-up delta | #153/#155 composition re-based | student A/B, instructor preview; 1440/768/390 | all 18 cases; T-62 NEG-1..NEG-5; score-quiz scoring matches independent arithmetic | existing | T allowance; Edge job needs its own allowance |
| R7 | T-09/T-10 on current `main` tree (SQL+API) then G3 browser oracle (#149) | R0 | T-09 runtime job; shared runner | learner, instructor; 1440/768/390 for G3 | 169 SQL / 48 API on the new tree; six-item oracle 4/6 33% -> 3/6 50% after legitimate completion | existing | T allowance |
| R8 | Video provider playback (requires outbound provider egress, which the sealed lane forbids by design) | #173 base/head decision; typecheck resolved | new reviewed job, not #173's | student, instructor preview; 1440/768/390, keyboard | play, seek, resume after reopen, captions present, private/removed video shows the honest state | egress allowlist only for provider hosts; receipts of every outbound host | **security-sensitive**: separate owner review and explicit user approval; not scheduled by this plan |
| R9 | Publish chain journey (draft -> publish -> catalog -> enroll -> learn -> unpublish -> rollback) | R3, R5, T-11 repair PR | builder job successor | instructor, admin, public, student; three sizes | readiness refused on empty curriculum; zero-row write surfaces an error; catalog/detail/learner agree after reload | existing | T allowance |
| R10 | Certificate journey J4 + verifier | R7, certificate owner assigned, copy decision | shared runner | learner, anon verifier; desktop + mobile | single issuance, PDF and verifier agree, incomplete denied, old certificate readable | existing | T allowance |
| R11 | Non-LMS smoke on the release candidate tree | release candidate; a one-time read-only triage of the 123 specs into runnable-on-isolated vs production-ref-bound (the latter are BLOCKED rows, owners re-point them, never this lane) | `readonly-courses` plus the runnable `chromium-public` set (`auth/**` minus `real-signup-and-login`, `landing/**`, `legal/**`, `survey/**`, `blog/**`, `portfolio/public-portfolio`, `career/career-pathway-public`) and the runnable member set (`dashboard`, `navigation/{layout,sidebar,theme-toggle,route-parity}`, `resources`, `events`, `interview-prep/{home,star-practice}`, `stubbed/app-sidebar-names`) | public and member; desktop, plus the 390 cases those specs already declare | 0 failures; every skip named with its reason; 0 unexpected console errors | existing | T allowance; the spec list is a proposal to the coordinator, who owns `e2e.yml` |
| R12 | Post-publish LIVE smoke (read-only accounts, no writes) | release; identity verification (section 7 item 1) complete | manual or stubbed Playwright against the published site | public, student, instructor, admin; 1440/768/390 | served chunk hashes equal a build of the released tree (the `data-commit-sha` attribute alone is not sufficient); ledger holds the released versions **and** `pg_policies`/`pg_proc` text equals the tree; core journeys read-only PASS | none (no writes) | user approval of the live read-only smoke and of the accounts used |

Elapsed-time note: R1 to R3 are independent once R0 lands and can run the same day. R4 to R7 depend on owner deltas. R8 is excluded from the core sequence until its egress route is approved. R9 to R12 are release-tail.

## 7. Release and rollback checklist

Separate milestones, in order; each is a receipt, not a check mark.

1. **Identity, established by read-only comparison, not by markers**: (a) frontend: a build of the released tree is hashed and its chunk names/hashes compared to the served `/assets/*` (the index attribute `data-commit-sha`, observed 82a97196 at 14:50Z, is a claim only); (b) database: `supabase_migrations.schema_migrations` holds every version the tree expects **and** the live `pg_policies` and `pg_proc` definitions for the affected objects equal the tree (a missing ledger row proves nothing about effect; an orphan apply proves nothing about the ledger); (c) functions: deployed Edge Function versions equal the tree's `supabase/functions` (presence is not deployment; deploy from file, never edit in flight).
2. **Migration compatibility**: before any apply, a read-only `pg_policies`/`pg_proc` snapshot of the affected objects to detect prior orphan applies; apply order `20261101000000..000600` then `20261102000000` through `db-migrate.yml` dispatched on the branch that holds the files (currently `main`), one file per dispatch with `verify_table`, then the two SQL confirmations from CLAUDE.md, then the same read-only snapshot again. `20261104010000` stays reserved until #164's contract is decided. Never `apply_migration`; never reuse a version; `npm run check:migrations` green. To the extent the scoped comparisons in preparation 1 hold (served UI at least post-#163; November contract not in force at 17:20Z), rows written by that UI during the window may be hidden from their authors by the new policies; the apply plan therefore carries a read-only pre-apply count per affected table and names the window from the first observation that showed post-#163 content (14:50Z marker, 17:14Z content) to the apply time. The marker and the ledger alone do not prove bundle identity or effective policy state; the direct reads do, within their stated scope. No historical achievement, grade, progression or certificate is recomputed, revoked or reissued by the apply.
3. **Rollback**: each migration file names its reverse (policy restore statements) in the apply plan; frontend rollback is a Lovable republish of the previous commit (`22ef5450` was the last verified published marker before today); ledger rollback is `RECORD:`-free, i.e. a reverse migration with its own new version, never deleting ledger rows.
4. **Cleanup**: no synthetic fixture rows on production (none are planned); isolated runs prove `leftovers: containers 0, volumes 0, networks 0` as run 41839316072 did; private outputs removed before upload.
5. **Error and unavailable states** covered before release: catalog unavailable vs zero; course detail for anon with denied counts; quiz start refused; grade save zero-row; roster error/retry; video unsupported/slow; certificate ineligible; all at three sizes where the screen exists.
6. **Post-release smoke** (R12) and a recorded "what is actually live" line in the tracker.
7. **Frozen refs**: #134, #143 untouched; no history rewrite; tracker updated in place.
8. **Apply-path hardening before the first live apply** (C12): the coordinator adds a `permissions:` block and an `environment:` with required reviewers to `db-migrate.yml` (its own reviewed PR), and this release uses single-file mode only. The apply plan records, per file, the reverse statements and the pre-apply read-only counts.
9. **Completion policy recorded** (C11) before `20261101000200` is applied; if the owner chooses (a) or (c), that file is superseded by a new version, never edited after the ledger row exists.
10. **Possibly mixed-state window**: if identity verification confirms that the served bundle is `main` 82a97196 while the backend is at the recorded 20261031 state, the release note must say which screens were live in that window and that no data correction is implied. If verification shows otherwise, the note records what was actually live.

## 8. Conditional effort and calendar waits

Not an ETA. Owner-sized effort only; this lane sizes its own work.

| Unit | Active effort (this lane) | Calendar wait (depends on) | Confidence |
|---|---|---|---|
| Tracker r7.41 reconciliation of this plan (coordinator applies) | 0.5 day | coordinator slot | high |
| R0 base confirmation and per-owner re-composition | 0 (coordinator and owners) | coordinator confirmation, then each owner's own re-composition when needed | medium |
| R1 | 0.25 day receipt reading | CI/CD build on 860ae5cd, coordinator qualification, fresh exact-profile one-run approval | low (POST `APPARMOR_E_UNKNOWN` root cause unresolved) |
| R2, R3 | 0.25 day each | allowances | medium |
| R4 | 0.5 day | S5 review, writer-policy decision, env approval | low |
| R5, R6, R7 | 0.5 day each | owner deltas | medium |
| R8 | not scheduled | security review | n/a |
| R9 to R11 | 1 to 2 days spec authoring in owner carriers | T-11 repair, certificate owner | low |
| Live apply + R12 | 0.5 day | explicit user grant | medium |

Discovery, unsized: non-LMS feature audit; certificate copy/versioning contract; bulk import contract; prerequisite/drip policy.

## 9. Policy and access choices: adopted 2026-11-04 18:11 UTC (relayed with the owner's Allow; recommended answers taken)

Recorded dispositions. Each is a decision of record for test authoring and for the owners' implementation; none is itself an authorization to run, apply, merge or publish, and each still needs its exact per-action approval and its implementation owner.

| # | Choice | Adopted disposition | What it unblocks | Who implements |
|---|---|---|---|---|
| 1 | Completion business contract | Interim contract: a legitimate **complete** attempt (quiz) or a final submission (assignment) is the minimum; kept score = the latest finalized attempt; no passing threshold is encoded until the owner states one. No historical achievement changes. | G3/G4 oracles may encode "complete attempt counts, started-only does not" and "latest finalized"; `20261101000200` is consistent with this interim contract | PR134 (schema), quiz owner (player), T-09 harness |
| 2 | Authoring policy (T-19/T-58) | Instructor-only course creation; co-instructor equals owner for content mutations; learners keep read access to enrolled content after unpublish; no new enrolments after unpublish | Publish-chain negatives (R9), N-C3, builder denials | Builder owner; PR134 for any policy migration |
| 3 | Certificate contract details | Versioned templates (new artifacts carry the template version; old artifacts render as issued); opt-out applies to new courses only; revoke anon EXECUTE on `check_course_completion` by a **new** migration version | J4 certificate journey (R10) and the certificate customization implementation | unassigned implementation owner (see 7); PR134 for the grant migration |
| 4 | Gradebook writer-policy exception | **No exception.** Positive object removal is proven through the authenticated Storage API on a run-owned object; no service role, trigger disable or policy widening | R4 S4/S5 contract | Gradebook owner, PR134 composition |
| 5 | Live read-only smoke accounts | **None yet.** R12 waits for identity verification (section 7 item 1) and a later explicit account grant | nothing now | owner |
| 6 | Runner base | The #172 line (c1c5e856 at adoption time) is the proposed base, **subject to the coordinator's confirmation**; per-owner re-composition only; no blanket re-base | R0 proposal can be sent to the coordinator by the owner | PR134 coordinator |
| 7 | Owners for retained work | To be assigned by the owner: certificates (WP-12), real bulk import (WP-08), theme consumers (WP-14), admin publish readiness repair (T-11). Adopting "recommended" here assigns no person; it records that these are implementation units, not scope decisions | scheduling of R9/R10 | owner assigns |

### 9b. Outward steps that are "next" in the plan, and why this lane does not take them (blocked batch)

| Step | Owner / gate | Status | Recommendation |
|---|---|---|---|
| R0 confirmation and the four per-owner re-compositions | PR134 coordinator, then each carrier owner | blocked on the coordinator's confirmation; touching any carrier is a reserved-file edit | owner relays the adopted base to the coordinator |
| Tracker r7.41 update | `docs/lms/backlog-tracker.md` is coordinator-owned; the owner's 17:36 instruction keeps the repository untouched | text is ready in preparation 4 | coordinator applies in place |
| Next E1 attempt (R1) | fresh exact-profile, one-run approval naming c1c5e856 / 15ebf278 / 1a11fef2...; owner's E1_OPEN diagnosis first | none approved | wait for the diagnosis; then one approval |
| R2 (#167 roster on 6e5e5126), R3 (#157 catalog at 768) | T allowance each; owners re-compose onto the confirmed base first | blocked on R0 | first two runs after R0 |
| R4 gradebook S0..S5 | user environment approval + T allowance; PR134 composition finalizing | blocked | after composition identity is final |
| `db-migrate.yml` hardening (permissions, environment) | coordinator's reviewed PR | not started | before any live apply |
| Live apply of `20261101*` and `20261102000000` | explicit user grant; completion contract now recorded (1); pre/post read-only snapshots per preparation 1 section D | blocked on the grant and on the hardening PR | sequence: hardening PR, snapshot, one file per dispatch, snapshot |
| Lovable Publish of any later `main` | owner action outside GitHub Actions | n/a | pair every Publish with the identity line |

Nothing above is taken by this lane without the named gate. This lane sends no message to another session.

1. **Completion business contract** (WP-03, C11): with legitimate assessed submission as the fixed minimum, what are the exact grading/passing thresholds per item type, and is the counted score latest, highest or kept? Needed before `20261101000200` is applied and before G3/G4 oracles encode numbers.
2. **Authoring policy** (T-19/T-58): self-service vs instructor-only course creation; co-instructor mutation rights; learner access after unpublish. Needed before the publish-chain and builder negatives are written.
3. **Certificate contract details**: template versioning scheme, opt-out semantics for new courses only, and the disposition of the anon `check_course_completion` grant. The customization requirement itself is retained.
4. **Gradebook writer-policy exception** for the S5 adapter: whether any receipt writer may be excepted, and under what proof. Needed before R4.
5. **Access for the live read-only smoke** (R12): which existing role accounts may be used, if any.
6. **Runner base confirmation** (R0): the coordinator confirms or replaces the proposed #172 line; no re-composition happens before that.
7. **Owners for unowned retained work**: certificates (WP-12), real bulk import (WP-08), theme consumers (WP-14), admin publish readiness repair (T-11). Assignment, not scope.

## 9a. Non-overlapping acceptance preparation (this lane, no runs, no source edits) — DONE 2026-11-04 17:25 UTC

Delivered as scratchpad files, not committed, not sent to any other session:
1. `prep-1-identity-verification-2026-11-04.md`: read-only results (served chunk graph with #163 present and #147 absent; live catalog showing every November migration not effective; live grants for the reorder RPCs and `check_course_completion`) and the before/after procedure for the coordinator's apply plan.
2. `prep-2-role-negative-cases-2026-11-04.md`: N-C1, N-C3, N-C6, N-C9 case proposals for the carrier owners.
3. `prep-3-playwright-spec-triage-2026-11-04.md`: the 123 specs classified; four specs hard-code the production ref without an env override and are BLOCKED for isolated runs until their owners re-point them.
4. `prep-4-tracker-r7.41-text-2026-11-04.md`: reconciliation text for the coordinator to apply in place.
5. Nothing else until a specific run is approved with its exact head, tree and profile.

## 10. Verification of this plan's own claims

Every "verified now" row in section 2.1 names its read; re-running the same reads (REST PR list, run 41839316072 jobs, `list_migrations`, GET `/`) reproduces them. No claim in sections 4 to 7 promotes a tier beyond what a named run or file shows.
