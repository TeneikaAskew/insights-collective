# Dead-Code Deletion Candidates — Verification List

Generated during the round-2 courses-flow audit (2026-07-24). Every file below was
verified unreachable: no route renders it, and no non-test file imports it
(`grep -rln` over `src/`, excluding `__tests__`). Nothing here affects the running
app; deleting them removes fabricated content and dead-table code from the tree.
All are recoverable from git history.

**How to verify any entry yourself:**
```bash
# 1) No imports outside the file itself / tests:
grep -rn "FILE_BASENAME" src --include="*.tsx" --include="*.ts" | grep -v __tests__
# 2) For pages: confirm no <Route> in src/App.tsx renders it.
```

## Group 1 — Fabricated forum stack (routes hard-redirect to /dashboard)

All forum routes in `src/App.tsx` are `<Navigate to="/dashboard" />`; the lazy
imports were already removed. `src/pages/ForumList.tsx` contains hardcoded fake
categories ("threads: 45, participants: 128"), fake authors ("data_wizard"),
and buttons that toast success with no database write.

| File | Why dead |
|---|---|
| `src/pages/ForumList.tsx` | Unrouted; fabricated content + fake-success buttons |
| `src/pages/ForumDetail.tsx` | Unrouted |
| `src/pages/ThreadDetail.tsx` | Unrouted |
| `src/components/forum/ForumList.tsx` | Only imported by the dead pages; hardcoded "0 threads / Last post: Never" |
| `src/components/forum/ThreadList.tsx` | Only imported by dead ForumDetail; "Subscribe" button has no onClick; mark-read is a TODO no-op |
| `src/components/forum/ThreadDetail.tsx` | Only imported by dead pages |
| `src/components/forum/NewThreadDialog.tsx` | Only imported by dead pages; submit is `toast.success` with no write |

## Group 2 — Dead-table stacks (backing tables verified ABSENT from the live database)

Probed live: `lesson_completions`, `lesson_completion_requirements`,
`content_progress` all return `42P01 relation does not exist`. The migrations
exist in `supabase/migrations/` but were never applied. No component below is
mounted anywhere.

| File | Why dead |
|---|---|
| `src/components/course/LessonCompletionButton.tsx` | Unmounted; drives lesson_completions (absent table) |
| `src/hooks/useLessonCompletion.ts` | Only consumer is the unmounted button |
| `src/services/lessonCompletionService.ts` | All four tables it touches are absent or mis-columned |
| `src/services/__tests__/lessonCompletionService.test.ts` | Tests of the dead service |
| `src/hooks/__tests__/useLessonCompletion.test.tsx` | Tests of the dead hook |
| `src/components/course/ModuleCompletionCard.tsx` | Unmounted |
| `src/hooks/useModuleProgress.ts` | Only consumer is the unmounted card; also contains an invalid `quiz_attempts→content_items` embed |
| `src/hooks/__tests__/useModuleProgress.test.tsx` | Tests of the dead hook |
| `src/components/course/grading/GradeDetailView.tsx` | Unmounted; drives grade_history/submission_comments (absent tables) |
| `src/components/course/grading/GradeHistoryViewer.tsx` | Only imported by GradeDetailView |
| `src/components/course/grading/SubmissionComments.tsx` | Only imported by GradeDetailView |

Note: `gradeService.ts`, `gradeHistoryService.ts`, `useGrades.ts`,
`useGradeHistory.ts` are NOT on the deletion list — they carry file-top comments
documenting the absent tables, throw honestly, and stay as the anchor for a
future grades migration.

## Group 3 — Unimported management components (only `CourseManagementDashboard` is routed)

`src/App.tsx` imports only `management/CourseManagementDashboard`; the dashboard
imports no siblings. Every other file in `src/components/course/management/` has
zero importers. `CourseSettings.tsx` is the worst offender: its save handler is
`// For this demo, we'll just simulate a successful save` — a setTimeout plus a
success toast with the real upsert commented out.

| File |
|---|
| `src/components/course/management/AssignmentManager.tsx` |
| `src/components/course/management/CanvasModuleManager.tsx` |
| `src/components/course/management/CourseAnalytics.tsx` |
| `src/components/course/management/CourseContent.tsx` |
| `src/components/course/management/CourseDetails.tsx` |
| `src/components/course/management/CourseEditor.tsx` |
| `src/components/course/management/CourseModuleManager.tsx` |
| `src/components/course/management/CourseSettings.tsx` |
| `src/components/course/management/CourseStudents.tsx` |
| `src/components/course/management/LessonManagerWithMigration.tsx` |
| `src/components/course/management/ModuleContentEditor.tsx` |
| `src/components/course/management/ModuleManager.tsx` |
| `src/components/course/management/QuizManager.tsx` |
| `src/components/course/management/QuizOptionsForm.tsx` |
| `src/components/course/management/WeekBasedModuleManager.tsx` |

Kept: `CourseManagementDashboard.tsx` + its test (routed at `/course-management`).

## Group 4 — Other unimported components

| File | Why dead |
|---|---|
| `src/components/course/video/TrackedVideoPlayer.tsx` | Zero importers; also contains log-only catches on progress load/save |
| `src/components/course/CourseInstructorsTab.tsx` | Zero importers; silent catches on add/remove instructor |

## Explicitly NOT deletion candidates (checked and kept)

- `src/hooks/useForums.ts` — honest post-cleanup implementation, tested; stays for a future forums re-enable.
- `src/lib/mock/courses.ts`, `src/lib/mock/users.ts` — referenced only by tests (test fixtures are legitimate).
- `useLessonProgress` — its `lesson_progress` table exists.

## Suggested command once approved

```bash
git rm src/pages/ForumList.tsx src/pages/ForumDetail.tsx src/pages/ThreadDetail.tsx \
  src/components/forum/ForumList.tsx src/components/forum/ThreadList.tsx \
  src/components/forum/ThreadDetail.tsx src/components/forum/NewThreadDialog.tsx \
  src/components/course/LessonCompletionButton.tsx src/hooks/useLessonCompletion.ts \
  src/services/lessonCompletionService.ts src/services/__tests__/lessonCompletionService.test.ts \
  src/hooks/__tests__/useLessonCompletion.test.tsx src/components/course/ModuleCompletionCard.tsx \
  src/hooks/useModuleProgress.ts src/hooks/__tests__/useModuleProgress.test.tsx \
  src/components/course/grading/GradeDetailView.tsx src/components/course/grading/GradeHistoryViewer.tsx \
  src/components/course/grading/SubmissionComments.tsx \
  src/components/course/video/TrackedVideoPlayer.tsx src/components/course/CourseInstructorsTab.tsx \
  src/components/course/management/{AssignmentManager,CanvasModuleManager,CourseAnalytics,CourseContent,CourseDetails,CourseEditor,CourseModuleManager,CourseSettings,CourseStudents,LessonManagerWithMigration,ModuleContentEditor,ModuleManager,QuizManager,QuizOptionsForm,WeekBasedModuleManager}.tsx
```
