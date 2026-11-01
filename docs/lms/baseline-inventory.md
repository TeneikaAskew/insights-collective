# Baseline inventory and provenance (WP-00)

Prepared 2026-10-31 in the Claude Code session bound to branch `claude/inspiring-shannon-wkmu6y`.
Nothing in this document was produced by writing to the live project; every live fact is a
read-only catalog query, a GitHub Actions log, or a file in this repository.

## 1. Provenance

### Handoff package (read in full, all three documents)

| Item | Value |
|---|---|
| Archive | `Insights_Collective_Dot_GitHub_Handoff_2026-10-31.zip`, 41,177 bytes |
| Archive SHA-256 | `888b67b5b4868dfb40b53ea2c5c19d13b29928acfbebb39c26a66983be885e02` |
| `DOT_START_HERE.md` | 3,863 bytes, 489 words, 46 lines, SHA-256 `5f46c6d7ca1310381e05886b2ee77d07fcc4314799c1c24d5b26c6084d98f09d` |
| `INSIGHTS_COLLECTIVE_DOT_MASTER_IMPLEMENTATION_PLAN.md` | 70,469 bytes, 8,647 words, 565 lines, 18 work packages WP-00 to WP-17, SHA-256 `382855c26a1a3e70453d27d69de07f4b14949912ba9c990740360bb8c6108258` |
| `INSIGHTS_COLLECTIVE_LOVABLE_PROMPT_ARCHIVE.md` | 29,134 bytes, 3,852 words, 245 lines, sections A0 to A10, SHA-256 `94b3d918171514d9fd64313eec1768c36e00b2cbfb1369154205513ae75dfb6c` |
| Total words | 12,988 |

### Git baseline

| Ref | SHA | Note |
|---|---|---|
| `origin/main` at handoff and at session start | `99f81e3ee5bf42c84fc8926c3e934b26d737a27b` | "Added real-course analytics tab", Lovable (`gpt-engineer-app[bot]`) |
| Pre-work baseline named in the plan | `6daac61b375980f1c6f01ead2534842399ce2dcf` | before IC-LMS-01 to 05 |
| IC-LMS-01 | `54d1b62ee8bba17a550c4c377287a5bfcabe79fa` | publishing contract |
| IC-LMS-02 | `599dbedec87651fba056abec2bf44687205466bc` | client-side assessed progression |
| IC-LMS-03 | `de8578cc0aacdc3bbdcbcdd25c4d0881f1cb6dcc` | gradebook normalization |
| IC-LMS-04 | `739052148fd6153dc66084b5dba592b1ef610139` | Students roster; guard migration committed |
| IC-LMS-05 | `99f81e3ee5bf42c84fc8926c3e934b26d737a27b` | Reports tab |

Thirty consecutive commits on `main` on 2026-10-31 are Lovable's; 34 files, about 1,800 insertions. No open pull requests; 79 remote branches; none named `fix/lms-*`, `feat/lms-*` or `test/lms-*`.

## 2. Environment and access status

| Item | Status |
|---|---|
| GitHub MCP | authenticated; read calls only so far |
| Supabase MCP | project `siuqvhscuiycvdrtiqsh` (the only project in the organization), `ACTIVE_HEALTHY`; catalog reads only |
| Container | Node 22.23, npm 10.9; dependencies installed with `npm install --legacy-peer-deps`; `npx vitest run` = 172 files, 1,595 tests passed, exit 0 (mocked Supabase; not backend proof) |
| Local database | PostgreSQL 16.15 installed from apt, cluster on `127.0.0.1:54329`; see §5 |
| E2E credentials | none present in this container (`E2E_*`, `SUPABASE_DB_URL`, `VITE_SUPABASE_*` all unset); `.env` absent |
| Playwright / Chromium | preinstalled; browser cannot reach Supabase over HTTPS directly (documented relay requirement) |
| Docker / Supabase CLI | Docker binary present but no daemon socket; Supabase CLI absent; a full local Supabase stack is therefore **not** available here |

## 3. Route matrix (source: `src/App.tsx`)

| Route | Element | Gate | Persona |
|---|---|---|---|
| `/courses`, `/course-list` | `CourseList` | VisibilityGate; RLS `published = true` | public |
| `/courses/:courseId` (+ `/modules`, `/announcements`, `/assignments`, `/grades`, `/people`) | `CourseDetail` | none client-side; RLS | public, student, instructor |
| `/courses/:courseId/learn`, `/learn/:moduleId/:itemId` | `CourseLearn` | none client-side; RLS on `content_items` requires enrollment | student |
| `/courses/new/builder`, `/courses/:courseId/builder` | `CourseBuilder` | `ProtectedRoute` (auth only); `useCoursePermissions` for existing course; wizard renders before the `canEdit` check for new courses | instructor, admin |
| `/course-management` | `CourseManagementDashboard` | none client-side | instructor |
| `/courses/:courseId/management` | redirect to builder | | |
| `/enrolled-courses` | `EnrolledCoursesDashboard` | `ProtectedRoute` | student |
| `/courses/:courseId/gradebook` | `CourseGradebook` | `ProtectedRoute` | instructor |
| `/courses/:courseId/assignments/:contentItemId/grade` | `CanvasGradingInterface` | `ProtectedRoute` | instructor |
| `/courses/:courseId/manage/assignments` | `InstructorAssignments` | none client-side | instructor |
| `/courses/:courseId/modules/:moduleId/assignments/:contentItemId/submit` | `CanvasAssignmentSubmission` | `ProtectedRoute` | student |
| `/courses/:courseId/modules/:moduleId/quizzes/:contentItemId` (+ `/results/:submissionId`) | `CanvasQuizTaking`, `CanvasQuizResults` | none client-side | student |
| `/courses/:courseId/modules/:moduleId/assignments/:assignmentId` | `AssignmentDetail` | none | student |
| `/courses/:courseId/{rubrics,rubrics/:rubricId,question-banks,quiz-results,materials,instructors,calendar,messages,progress,insights,insights/:studentId,certificate}` | respective pages | mostly none client-side | mixed |
| `/verify-certificate/:code` | `VerifyCertificate` | public | public |
| `/admin/courses`, `/admin/course-edit/:id` | `AdminCourses`, redirect to builder | `ProtectedRoute requireAdmin` | admin |
| legacy `/course/*`, `/courses/:id/modules/:m/lessons/:l`, `/courses/:id/forums*` | redirects | | |

## 4. Live catalog facts (read-only, 2026-10-31)

- Migration ledger: 233 rows, identical to the 233 repository files by version. Both 2026-10-31 migrations (`20261031120009`, `20261031120030`) are recorded and their objects exist: `trg_enforce_assessed_progression` (BEFORE INSERT OR UPDATE) and `enforce_assessed_progression()` with EXECUTE revoked from anon/authenticated. `docs/proposed-migrations/assessed_progression_guard.sql` still says "NOT APPLIED" and is stale.
- Trigger order on `content_item_progressions`: BEFORE `trg_enforce_assessed_progression`, then AFTER `trg_auto_issue_certificate`. The certificate trigger counts `read`/`completed`; the guard and `progressionStates.ts` also treat `graded` as done. Inconsistent "done" definition (tracker T-10).
- Cross-course read exposure (handoff WP-02) is **confirmed**: the SELECT policies "Instructors can view course progressions" (`content_item_progressions`), "Instructors can view quiz submissions" (`quiz_submissions`) and "Instructors can view quiz submission answers" (`quiz_submission_answers`) each include `'instructor'::app_role = ANY (get_user_roles(auth.uid()))`. `assignment_submissions` is course-scoped via `can_access_submission()`. `is_grading_staff()` is a global role check.
- `quiz_submissions` has SELECT and UPDATE policies for learners but **no INSERT policy** (dropped in `20260802234500`); `start_quiz_attempt` is the only path. `InlineQuizPlayer.tsx:226-234` still inserts directly (tracker T-08, browser repro pending).
- `check_course_completion(uuid, uuid)` is executable by `anon`.
- `enrollments` has `UNIQUE (user_id, course_id)`; zero duplicate pairs. `completion_status` is written only by the enroll insert (0) and the E2E seed; no app code updates it.
- Historical assessed progressions without a matching submission, using the guard's own predicate: 16 of 20 assignment rows (6 users), 7 of 9 quiz rows; 2 certificates exist and both belong to users with at least one such row in that course. Lovable reported 23/28 and 12/14 earlier the same day; the difference is unexplained and is **not** attributed to any cause without evidence. No row was changed.

## 5. Disposable local database (`scripts/local-db/`)

Why: the repository's migrations cannot be replayed from zero (the base tables such as `courses`, `profiles` and `blog_posts` predate the first migration file; a replay applied 28 of 233 files). Instead a schema snapshot was taken with read-only catalog queries (types, tables, constraints, indexes, views, 118 functions, 341 policies, 51 triggers, grants) and applied to a local PostgreSQL 16 together with `supabase-shim.sql`, which provides stand-ins for `auth.uid()`, `auth.users`, `auth.identities`, `storage`, `vault`, `cron`, `net` and `extensions`. The snapshot DDL was scanned for secret-shaped strings before use (none found) and lives outside the repository.

Result: 120 tables, 341 policies, 51 public triggers plus the `on_auth_user_created` shim trigger; one view (`quiz_analytics`) did not build. The RLS test `tests/01_cross_course_rls.sql` runs role-scoped checks by setting `request.jwt.claims` and `role`, exactly as PostgREST does. All runners refuse non-loopback connection strings.

## 6. CI evidence used

| Run | Result | Cause |
|---|---|---|
| `e2e.yml` run 609 (commit `de8578c`) | failure | query-validity: `db-functions.json` lacks `enforce_assessed_progression`; Playwright: 2 failed, both certificate journeys rejected by the new guard with 23514 |
| `e2e.yml` run 611 (commit `99f81e3`) | failure | same two plus `course-management.spec.ts` "students management is still a placeholder" (stale assertion after the roster shipped) |
| `test.yml` runs 1026 to 1032 | success | unit, lint, build |
| `nightly.yml` runs 391 to 393 | success | vitest only |

## 7. Served release lineage (owner read-only live-screen audit, 2026-10-31)

| Item | Value | Source |
|---|---|---|
| Public deployment commit | `ffa7d23082432add6ba1df42fe68e95bfda91115` ("Fix two E2E flakes at their root…", PR #132, 2026-08-30) | `data-commit-sha` in the served HTML |
| Deployment UUID | `7d58930f-286a-4045-83c3-559743516c7d` | served HTML |
| Source maps | CourseBuilder, CourseShell, Curriculum match that release exactly, not `main` | owner source comparison |
| Distance to `main` | 39 commits (`ffa7d230..99f81e3e`) | `git log` |
| Consequence | Students/Reports "Coming Soon", the DRIP badge and missing grades shown as 0/F are observations of the old release; `main` already changes them (IC-LMS-03/04/05). They are **not** to be reimplemented. No deployment is authorized by the audit; a verified build/QA release lineage is to be prepared later | tracker T-38 |
| Persistent in served source AND `main`/`3370e5dd` | Navbar over rail (T-39); public detail page blank instructor / 0 lessons / error toast (T-40); calendar RPC on mount for anon (T-41); no custom-certificate consumer (T-23) | owner audit + code |
| Audit scope | 9 actual observations across 11 screens; public and authenticated; no progress, quiz or certificate writes; tiers kept separate from write-dependent full acceptance | owner |

