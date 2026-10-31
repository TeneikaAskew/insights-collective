# Unified LMS backlog tracker

One list for the whole Insights Collective course-platform effort. It merges the October 31, 2026
handoff (master plan WP-00 to WP-17, Lovable prompt archive A0 to A10, start-here note) with the
independent repository audit from the Claude Code session (findings F1 to F7). Provenance, hashes
and live-catalog facts are in [`baseline-inventory.md`](./baseline-inventory.md); CI trigger facts
and the publication gate are in [`publication-gate.md`](./publication-gate.md).

Status vocabulary and evidence tiers are defined in [`README.md`](./README.md). A `Verified` entry
names its tier; none of the entries below has reached end-to-end acceptance (`browser` tier) yet.

Baseline for every entry: `main` = `99f81e3ee5bf42c84fc8926c3e934b26d737a27b`. Working branch:
`claude/inspiring-shannon-wkmu6y` (local commits only until the publication gate is confirmed).

## A. Work packages WP-00 to WP-17

| WP | Title (plan §) | Priority | Status | Tracker items |
|---|---|---|---|---|
| WP-00 | Repository, environment, evidence and scope baseline | P0 | In progress: inventory and provenance written; local isolated database built; isolated E2E target still a decision | T-00, T-01, T-02, T-03, T-04, T-06 |
| WP-01 | Actual visual and functional screen inspections | P0/P1 | Unfinished QA: no browser matrix captured yet; depends on credentials or an isolated stack | T-29 |
| WP-02 | Cross-course security, RLS and authorization | P0 | Fix drafted and proven on local DB; production apply is a Decision | T-05, T-30 |
| WP-03 | Progress, assessments, completion, historical records | P0 | Guard verified live; definitions inconsistent; anomaly report pending approval path | T-06, T-07, T-08, T-09, T-10 |
| WP-04 | Publishing and save consistency | P0 | Done-code (IC-LMS-01) partly; admin bypass and detail-page filter open | T-11, T-12 |
| WP-05 | Gradebook, SpeedGrader, attempts, exports | P0/P1 | Done-code (IC-LMS-03) partly; attachment mismatch, bulk attempt, CSV bytes open | T-13, T-14 |
| WP-06 | Instructor Students tab | P1 | Done-code (IC-LMS-04); metrics source and browser test open | T-15, T-16 |
| WP-07 | Instructor Reports tab | P1 | Done-code (IC-LMS-05); metrics source and screen tests open | T-15, T-17 |
| WP-08 | Course creation wizard, import, curriculum studio | P1 | Incomplete; two advertised methods are no-ops | T-18, T-19 |
| WP-09 | Video/media player and persisted viewing | P1 | Incomplete; tracked player unmounted | T-20 |
| WP-10 | Student learning player redesign | P1 | Incomplete | T-21 |
| WP-11 | Notifications, discussions, messages, cohorts, live | P1/P2 | Incomplete; cohorts/live are P2 | T-22 |
| WP-12 | Certificates and completion design | P1 | Incomplete; custom copy unused; anon RPC grant | T-23 |
| WP-13 | Prerequisites, drip, scheduling | P2 | Not started, after integrity | T-24 |
| WP-14 | Design templates, visual consistency, storefront | P1/P2 | Incomplete; presets have no consumer | T-25 |
| WP-15 | Admin, instructor operations, governance | P1 | Incomplete; dead-code retirement rules apply | T-26, T-28 |
| WP-16 | Commerce, partnerships, interoperability | P2, optional | **Decision**: not assumed required | T-27 |
| WP-17 | Accessibility, reliability, security, analytics, operations | P0 to P2 | Cross-cutting; items filed where they bite | T-28 |

## B. Lovable prompt archive A0 to A10 (preserved status)

| Archive | Prompt | Lovable status (from archive) | Tracker position |
|---|---|---|---|
| A0 | Read-only audit | Accepted; wrote `.lovable/plan` despite read-only | Superseded by this tracker; its findings reconciled in section D |
| A1 | IC-LMS-01 publishing | Accepted, code landed `54d1b62` | T-11, T-12 (repair, not redo) |
| A2 | IC-LMS-02 completion integrity | Accepted, code landed `599dbed`; backend guard added later in A4 | T-06, T-09, T-10 |
| A3 | IC-LMS-03 gradebook | Accepted, code landed `de8578c` | T-13, T-14 |
| A4 | IC-LMS-04 Students roster (+ appended "apply the guard") | Accepted, code landed `7390521`; migrations applied live | T-15, T-16; T-06 verified |
| A5 | IC-LMS-05 Reports | Accepted, code landed `99f81e3` | T-15, T-17 |
| A6 | IC-LMS-06 acceptance gate | **Queued, stopped, never ran** | **Unfinished QA**, owned here as T-29 |
| A7 | IC-LMS-07 student/public browser audit | **Rejected (out of credits), not queued** | **Unfinished QA**, T-29 |
| A8 | Instructor browser audit | **Drafted, never sent** | **Unfinished QA**, T-29 |
| A9 | Known instructor issues list | Not a prompt | Each bullet mapped: T-11, T-18, T-20, T-13/T-14, T-23, T-25, T-05, T-26, T-29 |
| A10 | How to translate into GitHub work | Guidance | Applied: repair not redo, QA mandatory, security and integrity before polish |

## C. Tracker items

Columns: Source = WP / archive / audit finding. Evidence tier in parentheses after a status.

| ID | Source | Requirement | Status (tier) | Evidence | Acceptance gate / next step |
|---|---|---|---|---|---|
| T-00 | WP-00, Start Here | Baseline inventory, route matrix, provenance, tracker | Done on branch (code) | `docs/lms/*` | Reviewer reproduces provenance from §1 of inventory |
| T-01 | WP-00 §5, Start Here | Isolated non-production target for mutating E2E | **Partly solved (local-db); browser tier still Decision** | Only one Supabase project exists; Docker daemon and Supabase CLI unavailable here. Local PostgreSQL 16 snapshot built (`scripts/local-db/`): the full `e2e/fixtures/seed.sql` applies offline with exit 0 after `local-preseed.sql` (6 courses, 2 content items, 1 certificate, 14 notifications, all synthetic). `global-teardown.ts` with default env logs "DB teardown disabled" and returns without network writes | Owner chooses for browser-tier runs: read-only browser checks against production, or provision an isolated Supabase project (paid; not done) |
| T-02 | F1, WP-15 | Certificate journey fixtures fail against the new guard | Repaired on branch (code); CI failure confirmed (ci) | runs 609/611 error 23514; helper `e2e/journeys/_helpers/assessedCompletion.ts` submits assignments and starts quizzes through `start_quiz_attempt` before marking complete; eslint clean | Passes in the next E2E run that is allowed to execute |
| T-03 | F1 | Stale "students management is still a placeholder" assertion | Repaired on branch (code) | `e2e/courses/course-management.spec.ts` now asserts the real roster view states | Same as T-02 |
| T-04 | F2 | `db-functions.json` fixture drift | Repaired on branch (live-catalog) | regenerated from `pg_proc` (118 names, only `enforce_assessed_progression` added) | `refresh-db-functions.mjs --check` exits 0 in CI |
| T-05 | WP-02, A4, A5, A9 | Instructor-role clause grants cross-course reads on progressions, quiz submissions, quiz answers | **Confirmed in catalog (live-catalog); exploit path proven (local-db); fix drafted** | Policy text in inventory §4. Local test `scripts/local-db/tests/01_cross_course_rls.sql`: on the live-equivalent snapshot 4 of 10 checks FAIL (instructor B, self-enrolled in course A, reads student A's progression and quiz submission; `got 1, expected 0`); the clause alone is shielded by `content_items` RLS, and self-enrollment in any published course removes that shield. Expanded matrix (3 tables × 9 actors incl. owner, co-instructor via course_assignments, enrolled instructor, unrelated instructor, both students, admin, anon): 51/54 on live-equivalent, the enrolled instructor reading another learner's rows in all three tables; 54/54 with migration `20261101000000_scope_instructor_reads_to_own_courses.sql` applied locally | **Decision**: apply via `db-migrate.yml` after review. Then direct PostgREST A/B test on the live project (read-only probes) |
| T-06 | WP-03 §1, A2/A4 discrepancy | Assessed-progression guard applied and ordered before certificate issuance | Verified (live-catalog) | ledger rows `20261031120009/30`; `pg_trigger` BEFORE/AFTER order | Mark `docs/proposed-migrations/assessed_progression_guard.sql` stale (this branch) |
| T-07 | WP-03 §6-7, Start Here | Read-only historical anomaly report; no automatic deletion or revocation | Counted (live-catalog); report not yet delivered | 16/20 assignment, 7/9 quiz done-rows without submission, 6 users; 2/2 certificates affected. Lovable's 23/28 and 12/14 differ; cause unproven | Deliver admin-only report outside GitHub; **Decision** on reconciliation |
| T-08 | F3, WP-03 §3 | Inline quiz player inserts `quiz_submissions` directly; learners have no INSERT policy | Policy gap confirmed (live-catalog); **browser repro still needed** | `InlineQuizPlayer.tsx:226-234`; `pg_policies` on `quiz_submissions`; `20260802234500` dropped the policy | Repro as a student in a browser, then route through `start_quiz_attempt` |
| T-09 | F4, WP-03 §4, plan §9 | Guard accepts `pending_review`, so a started quiz counts as done | Verified (local-db); **Decision** (completion policy) | `scripts/local-db/tests/02_assessed_progression_guard.sql`: a started-only quiz (no answers, no score) is accepted as complete and a certificate is issued; a genuinely submitted assignment or complete quiz is tested separately and also accepted; draft/missing submissions refused | Owner sets submitted-minimum vs passed/graded; then align trigger, UI, certificate |
| T-10 | WP-03 §3 | One definition of "done" across UI, RPC, trigger, reports | Incomplete (code) | certificate trigger: `read`,`completed`; guard and `progressionStates.ts:13`: plus `graded` | Single helper and one SQL predicate |
| T-11 | WP-04, A1, F7 | AdminCourses publishes without the readiness guard | Incomplete (code) | `useCoursesManagement.ts:316-323` vs `CourseBuilder.tsx:320-337` | Shared guard; Playwright publish/unpublish click test |
| T-12 | WP-04 §1-3 | All `published`/`status` readers and writers consistent; detail page relies on RLS only | Done-code partly (IC-LMS-01); Incomplete | `coursePublish.ts`; `CourseDetail.tsx:391-430` | Catalog, detail, learner, admin agree after reload |
| T-13 | F5, WP-05 | Attachments stored as signed URL (Canvas page) vs bucket path (inline); grader reads paths | Incomplete (code) | `CanvasAssignmentSubmission.tsx:205-214`; `InlineAssignmentSubmit.tsx:258-268`; `SubmissionAttachments.tsx:38,108,157` | Store paths everywhere; plan for existing rows |
| T-14 | WP-05, A3 | Bulk grading attempt selection, CSV byte check, "Late", drill-down, stale `gradeService` comment, "highest" label | Done-code partly (IC-LMS-03); Incomplete | `gradebookData.ts`; `CanvasQuizResults.tsx:348` | Independent CSV parse; role tests |
| T-15 | F6, WP-06 §2, WP-07 §4 | Roster and Reports headline metrics read `enrollments.completion_status`, which the app never writes | Incomplete (code, live-catalog) | `courseReportService.ts:55,103-105`; `Dashboard.tsx:212`; writers are enroll insert (0) and E2E seed | Compute from progressions; distinguish 0 from unknown |
| T-16 | WP-06, A4 | Students tab browser-tested as five personas; per-student drill-down | Done-code; not verified | no E2E for `?view=students` besides T-03 | Screenshots 1440/390/768; denial without name leak |
| T-17 | WP-07, A5 | Reports screen-level tests and reconciliation | Done-code; not verified | no E2E for Reports tab | Metrics match source rows for fixture course |
| T-18 | WP-08, A9 | Wizard "Bulk upload" and "Copy from another course" are no-ops | Incomplete (code) | `NewCourseWizard.tsx:100-107,365-388` | Implement or remove; no placeholder success |
| T-19 | WP-08 §1 | New-course route has no client role gate; RLS is the only gate | Incomplete (code) | `CourseBuilder.tsx:595` before `:611`; `courses_creator_access` policy | Gate plus RLS test |
| T-20 | WP-09, A9 | Tracked video player not mounted in active learner | Incomplete (code) | `TrackedVideoPlayer.tsx` unimported | Playback, resume, completion policy verified |
| T-21 | WP-10 | Learner player redesign with feature parity | Incomplete | Canvas and inline paradigms coexist (`App.tsx:363-370`) | Parity matrix plus screenshots |
| T-22 | WP-11 | Notifications, discussions, messaging scoping; cohorts/live P2 | Incomplete | discussions and `open_course_thread` exist | Scoping tests |
| T-23 | WP-12, A9 | Certificate custom copy unused; `check_course_completion` callable by anon | Incomplete (live-catalog) | `has_function_privilege('anon', …)` true | Copy flows to artifact; grant **Decision** |
| T-24 | WP-13 | Prerequisites and drip | Not started (P2) | `CourseProgressOverview.tsx:72-87` display only | After integrity |
| T-25 | WP-14, A9 | Theme presets have no consumer in learner | Incomplete (code) | `CourseDesignView.tsx` saves `theme.preset` | Observable change after reload |
| T-26 | WP-15 §6, Start Here | Retire dead hooks and `gradeService` only with import graph | Incomplete | legacy tables hold 0 to 4 rows live | CI green after each removal |
| T-27 | WP-16, plan §9 | Commerce, SCORM/LTI | **Decision**, not assumed | | Owner call |
| T-28 | WP-17, F7 | StudentInsights activity not course-scoped; unrendered `LoginOverlayCard`/`CourseContentPreview` | Incomplete (code) | `StudentInsightsDashboard.tsx:258-337` | Scoped queries |
| T-29 | A6, A7, A8, WP-01 | Screen-by-screen acceptance matrix, desktop and mobile, all personas | **Unfinished QA** | none captured; Lovable reviews never ran | Every row PASS/FAIL/BLOCKED with real screenshots |
| T-30 | Start Here, WP-00 §5, owner 2026-10-31 | Fail-closed E2E target validation and production-safe PR workflow | Verified (ci for the PR path; local for the guard); automatic production opt-in removed | `scripts/e2e/assert-safe-target.mjs` (refuses production unless explicitly named; exercised: unset → exit 3, production URL → exit 3, loopback → ok, opt-in → ok); wired into `e2e.yml` seed step and `global-setup.ts`; PR runs get no opt-in | **Decision**: see `publication-gate.md` open points |
| T-31 | audit (local-db), WP-02 | `start_quiz_attempt` never checks `can_access_quiz`: any signed-in account starts attempts on any quiz, published or not, in any course; such a row satisfies the completion guard | **Confirmed (local-db on live-equivalent schema); fix drafted** | `scripts/local-db/tests/03_start_quiz_attempt_authz.sql`: 6/10 on live-equivalent, 10/10 with `20261101000100_start_quiz_attempt_requires_quiz_access.sql` applied locally; anon already refused | **Decision**: apply via `db-migrate.yml` after review |
| T-32 | audit (live-catalog) | `public.quiz_analytics` view is self-referential and raises 42P17 on any read | Verified (live-catalog) | `select count(*) from public.quiz_analytics` → infinite recursion; no consumer in `src/`; excluded from the local replay manifest explicitly | Drop or redefine; needs owner call since it is live schema |

## D. Contradictions resolved

- The plan's "RLS issue reported by Lovable" is now a catalog-confirmed defect with a proven exploit path (T-05), narrower than "any instructor reads any course": it requires the instructor to be able to read that course's `content_items`, which self-enrollment grants.
- The plan's "guard reported applied" is verified live (T-06); the proposed-migration document is stale.
- Lovable's anomaly counts are replaced by a live recount with the predicate stated; the difference is recorded, not explained (T-07).
- The Lovable audit plan's "no broken course routes" stands; the inline-quiz finding is a policy gap on a working route, not a broken route (T-08).
- The E2E failures on `main` are fixture debt created by a correct guard, not product regressions (T-02, T-03).

## E. Dependency-ordered delivery plan (draft PRs, one acceptance criterion each)

1. `docs` — tracker, inventory, publication gate (T-00, T-06 stale-doc note).
2. `test/ci-truth` — T-02, T-03, T-04, T-30. Acceptance: query-validity green; E2E green on the next allowed run; PR runs fail closed at the guard.
3. `fix/cross-course-rls` — T-05 migration plus local RLS test. Acceptance: local test passes on fixed DB and fails on baseline; owner approves `db-migrate.yml` dispatch; live A/B read-only probe afterwards.
4. `fix/completion-integrity` — T-08 (after browser repro), T-10; T-07 report delivered privately; T-09 waits on the completion-policy decision.
5. `fix/publish-guard` — T-11, T-12.
6. `fix/gradebook` — T-13, T-14.
7. `fix/metrics-source` — T-15, T-16, T-17.
8. P1 in plan order: T-18, T-19, T-20, T-21, T-23, T-25, T-22, T-24, T-26, T-28; T-27 only on decision.
