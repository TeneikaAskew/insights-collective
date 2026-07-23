# Courses Flow — Fallback & Failure-Masking Audit

**Date:** 2026-07-23
**Scope:** every course-flow page, route, service, hook, and related edge function.
**Goal:** find and eliminate *failure-masking fallbacks* — code that swallows errors and renders defaults (empty lists, zeros, hardcoded values, success toasts) so a failure looks like success.

## The error-handling convention now enforced

| Layer | Rule |
|---|---|
| Services (`src/services/`) | Every Supabase call destructures `{ data, error }` and throws immediately on `error`. No catch-and-return-default. Partial multi-step failures throw an error naming what did and didn't happen. Unimplementable features throw `'... is not available'` instead of fake-succeeding. |
| Hooks (`src/hooks/`) | React Query hooks let the query function throw (errors surface via `isError`/`error`). State-based hooks expose an `error` state; data stays `null` on failure — never zeros or partial results presented as complete. Empty data is **not** an error. |
| Pages / components | Four visibly distinct states: loading, error (shared `CourseErrorState` with a Retry button), empty, success. No mock or placeholder data on error; UI elements with no real backing data are hidden, not filled with invented values. |

Tests enforce this: every course service and hook now has error-path tests that inject a database failure and assert the code **throws/surfaces it** rather than returning defaults.

## Schema-reality findings (root causes)

- **The `grades`, `grade_history`, `submission_comments`, `grading_sessions`, and `grade_notifications` tables do not exist** in the generated Supabase schema (`src/integrations/supabase/types.ts`). Every query against them fails at runtime; several call sites swallowed those failures. Grade data genuinely lives in `assignment_submissions` (`grade`, `score`, `graded_at`, `grader_comments`, `workflow_state`) and `quiz_submissions`.
- `assignment_submissions` has **no `graded_by` or `status` columns** — code that wrote them failed silently.
- `certificates` exists (no `revoked` column — revocation is row deletion; no FK to profiles — names need a second query). Certificates are auto-issued by a DB trigger on course completion.
- `question_category_links` **does** exist — the category filter that pretended it didn't was a silent no-op.

## Findings and resolutions

Status key: ✅ fixed in this branch · ✔ already fixed on main before this work · ⏳ deferred (reason given).

### Fake success / fabricated data (most severe)

| # | Location | Failure mode | Status |
|---|---|---|---|
| 1 | `src/pages/AdminCourses.tsx` certificates tab | Hardcoded fake certificates ("John Doe", "Jane Smith"); Issue/Download/Revoke buttons fired success toasts with **no database call at all** | ✔ (real query + real revoke with confirm; manual issue removed — auto-issue trigger is the source of truth) |
| 2 | `src/hooks/useForums.ts` | Returned fabricated forums/threads/posts on query error **and** when the real list was empty | ✅ all mock data deleted; queries throw; empty returns `[]` |
| 3 | `src/services/gradeService.ts` `importGradesFromCSV` | Stub mapped no CSV fields, upserted empty rows, reported success | ✅ now throws `'not available: the grades table does not exist'` |
| 4 | `src/services/gradeHistoryService.ts` `getGradingStats` | Hardcoded `most_active_grader: 'TBD'` presented as data; grading-sessions query error swallowed into `average_grading_time: 0` | ✅ computed from real rows / null; error thrown |
| 5 | `src/pages/CourseList.tsx`, `CourseDetail.tsx`, `CourseCard.tsx` | Hardcoded `rating: 4.5` and `enrollmentCount: 0` on every course | ✔ rating removed (renders only when real); counts from real queries |

### Errors swallowed into "empty/zero" states

| # | Location | Failure mode | Status |
|---|---|---|---|
| 6 | `src/hooks/useProgressTracking.ts` | Ignored every query error; failed fetches rendered **0% progress as fact** | ✅ all queries throw; error state exposed; progress stays null on failure |
| 7 | `src/services/videoAnalyticsService.ts` (4 reads) | Errors → `null`/`[]`/zeroed summary ("student watched nothing") | ✅ throw |
| 8 | `src/services/contentDiscussionService.ts` (all reads + `resolveThread`) | Errors → `[]`/`0`/`false`; bulk-resolve result never checked | ✅ throw; update checked |
| 9 | `src/services/courseCalendarService.ts` | Failed source queries silently dropped that event category; `'Unknown Course'` title fallback; failed enrollments lookup → empty calendar | ✅ any source error throws |
| 10 | `src/services/assignmentService.ts` `gradeSubmission` | Upserted into nonexistent `grades` table, swallowed the always-failure, reported success | ✅ dead upsert removed; `assignment_submissions` is sole source of truth |
| 11 | `src/services/assignmentService.ts` `createAssignment` | Rubric-attach failure only console.errored — assignment silently created without its rubric | ✅ throws descriptive partial-failure error |
| 12 | `src/services/lessonCompletionService.ts` `checkLessonRequirements` | Sub-query errors reported `met=false` as fact; `'submit'` satisfied by **any** submission (unscoped); `minimum_score` queried nonexistent `grades`; `'participate'` hardcoded false | ✅ errors throw; submit/minimum_score scoped to the requirement's assignment via `assignment_submissions`; non-evaluable checks return explicit `unavailable: true` |
| 13 | `src/services/quizService.ts` | `storeQuizAttempt` catch-all → null; initial-message store failure only logged | ✅ throw |
| 14 | `src/services/questionBankService.ts` `getQuestions` | Category filter silently no-opped — returned unfiltered results | ✅ real filtering via `question_category_links` |
| 15 | `src/services/gradeService.ts` `calculateCourseGrade` | `totalPossible` never accumulated (always 0) | ✅ accumulates real points |
| 16 | `src/hooks/useCoursesManagement.ts` | Enrollment-count query failure → every course silently "0 enrolled" | ✅ throws to error state + toast |
| 17 | `src/hooks/useCourseEnrollments.ts` | Profile-join failure logged only (rows rendered with missing names); stats RPC failure silent | ✅ profile error throws; stats failure explicitly falls back to client-side recompute from loaded data |
| 18 | `src/hooks/useCanvasContent.ts` `useModuleContentCounts` | Mid-loop failure left partial counts presented as complete | ✅ error state; partial counts never exposed |
| 19 | `src/hooks/useModuleProgress.ts` `submitAssignment` | Secondary submission upsert unchecked — success toast after partial write | ✅ throws `'Progress was saved, but the submission record failed'` |
| 20 | `src/hooks/useCourseData.ts` / `useCoursePermissions.ts` / `useLessons.ts` | Unchecked errors on enrollment count / profile fallback / lesson_progress cleanup | ✅ throw (permissions fail closed) |
| 21 | `src/pages/CourseDetail.tsx` | Announcements fetch silently ignored errors; **enrollment recorded in localStorage and UI before the insert, never rolled back on failure** | 🔄 in progress (Phase D) |
| 22 | `src/pages/CourseMaterials.tsx` | Load used `?? []` without error checks — failure rendered as empty folder | 🔄 in progress (Phase D) |
| 23 | `src/pages/EnrolledCoursesDashboard.tsx` | Sidebar fetch unhandled; hardcoded `'Active'` status; module counts derived arithmetically from a percentage; stock-photo thumbnail; generic 'Instructor' | 🔄 in progress (Phase D) |
| 24 | `src/components/certification/CertificationSystem.tsx` | Fetch errors ignored — a DB outage rendered as "Invalid verification code" | 🔄 in progress (Phase D) |
| 25 | `src/components/course/analytics/StudentInsightsDashboard.tsx` | Loader catch swallowed; `timeSpent: 0` fabricated; placeholder detail tabs | 🔄 in progress (Phase D) |
| 26 | `src/pages/CourseGradebook.tsx` | `grades: any[] = []` hardcoded ("placeholder until migration"); wrote nonexistent `graded_by`/`status` columns (silent failure) | 🔄 in progress (Phase E) |

### Placeholder UI pretending to be features

| # | Location | Status |
|---|---|---|
| 27 | `CanvasGradingInterface` "File attachments would be displayed here" (instructors couldn't see submissions) | 🔄 in progress (Phase D) |
| 28 | `QuestionBankManager` "coming soon" tabs, `QuestionEditor` matching type, `AssignmentSubmission` media recording | 🔄 in progress (Phase D) |
| 29 | Dead unrouted pages (`LessonDetail` with fake video player, `CanvasModuleDetail`, `AdminCourseEdit`, `CourseManagement`) lazy-imported but unreachable | 🔄 in progress (Phase D) |
| 30 | `CanvasQuizTaking` kept-score "simple policy" | ⏳ documented as deliberate latest-attempt policy — no keep-highest spec exists |

### Edge functions (fixed in code — **not deployed from this session**)

| # | Function | Failure mode | Status |
|---|---|---|---|
| 31 | `course-calendar-feed` | Failed source query silently omitted that category from the ICS while returning 200 | ✅ any source error fails the feed |
| 32 | `notify-course-announcement` | Recipient lookup failures silently dropped; total Resend failure still returned `status: 'ok'`; `notified_in_app` hardcoded 0 | ✅ failures counted and reported; total email failure → 502 `email_failed`; misleading field removed |
| 33 | `verify-certificate` | RPC error fell through to 404 `not_found` — an outage looked like an invalid certificate | ✅ returns 500 `error` |

## Test coverage delta

Before: 7 unit test files, 62 tests; 9 of 11 course services, 16 of 18 course hooks, and **all** course pages untested; the shared Supabase mock defaulted to success so silently swallowed errors were undetectable. `npm run test` also mistakenly collected 94 Playwright specs as failures.

After: every course service and hook has happy-path **and** error-injection tests; course pages have loading/success/empty/error state tests; regression tests pin the worst masks (failed fetch is not 0% progress; no mock forum content ever renders; `grades` table is never queried; enroll failure does not mark the client enrolled). Vitest now collects only `src/` tests.

Final counts are in the PR description; the suite, `npm run lint`, and `npm run build` gate every commit on this branch.

## Known limitations / future work

- **Grades migration:** if real gradebook storage beyond `assignment_submissions`/`quiz_submissions` is wanted, add a `grades` table migration; `gradeService`/`gradeHistoryService` remain as throwing stubs documenting this.
- **Ratings:** course ratings render only when real data exists; a `course_feedback`-backed aggregate is future work.
- **Submission file uploads:** the schema stores `url`/`body` only — true file-attachment storage needs a storage bucket + column.
- **Participation tracking:** no backing data source; lesson requirements report it explicitly as unavailable.
- **Time-spent analytics:** no tracking source; the fabricated always-0 metric was removed rather than invented.
- **RLS:** admin certificate revocation and some instructor queries depend on row-level-security policies that can't be verified from this environment; failures now surface visibly instead of silently.
- **Edge functions** require deployment (`supabase functions deploy ...`) to take effect.
