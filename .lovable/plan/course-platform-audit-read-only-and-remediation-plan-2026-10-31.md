# Course Platform Audit (read-only) and Remediation Plan

No files, data, or settings were changed. "Verified" means seen in the code. "Unverified" means a risk nobody has run yet.

## Severity matrix

| Sev | Area | Finding | Evidence | Status | Fix type |
|---|---|---|---|---|---|
| High | Instructor grading | The Gradebook "Export" button shows "Export Started" but no file ever downloads (a fake success) | `src/components/course/gradebook/Gradebook.tsx:275-281` | Verified | Incremental |
| High | Instructor curriculum | Every section shows a "Drip" badge, but there is no way to schedule content | `src/components/course/builder/teachable/CurriculumView.tsx:308-312` | Verified | Incremental (hide it) or redesign (build real drip) |
| High | Data integrity | Five separate ways of storing progress and content. The learner uses `modules` + `content_items` + `content_item_progressions`. Old hooks for `lessons`, `module_content`, `lesson_progress`, `module_progress`, `content_progress` and `lesson_completions` are still in the code | `useLessons.ts`, `useModuleContent.ts`, `useLessonProgress.ts`, `useModuleProgress.ts`, `useLessonCompletion.ts` (nothing imports them); `lessonCompletionService.ts` | Verified | Incremental (rename to OLD, then remove) |
| High | Grading | Two grading paths. `CourseGradebook` reads submissions, but `gradeService.ts` reads a `grades` table that its own comments say does not exist. CSV import throws | `src/pages/CourseGradebook.tsx:173,197`; `src/services/gradeService.ts:13,148,182-189` | Verified | Incremental (one source of truth) |
| High | Security | Role checks in the browser fall back to `profile.roles.includes('admin')`. The real boundary is RLS and RPC, which this audit did not check | `src/hooks/useCoursePermissions.ts:59-91` | Unverified | Separate RLS audit |
| Med | Builder tabs | Pricing, Sales pages, Students and Reports are clearly marked "coming soon". Instructors can't see students or reports inside the builder | `TeachableShell.tsx:71-74`; `CourseBuilder.tsx:48-70,683-698` | Verified | Redesign (Students + Reports) |
| Med | Add content | Bulk upload is always disabled ("Coming soon"). The Upsell and Referrals tiles are disabled | `CurriculumView.tsx:428-437`; `AddContentPanel.tsx:99-100,142-149` | Verified | Hide or build |
| Med | Assessments | Inline quiz and assignment players run next to the standalone Canvas-style submission and quiz pages | `LessonViewer.tsx:160-165`; `src/App.tsx:363-370` | Verified | Redesign (one paradigm) |
| Med | Prerequisites | Locks are worked out in the overview from `prerequisite_module_ids`. I didn't find authoring UI or enforcement in the learner | `CourseProgressOverview.tsx:72-87,115,496` | Unverified that it can be bypassed | Incremental |
| Med | Video analytics | The dashboard reads video summaries, but no player calls the recording methods, so the data stays empty | `videoAnalyticsService.ts:51-160`; `StudentInsightsDashboard.tsx:233-241` | Verified (no caller) | Incremental |
| Low | Naming | "Code example" makes a plain page, not a graded coding challenge. `code_challenges` is only used in interview prep | `AddContentPanel.tsx:89`; `interview-prep/CodePractice.tsx` | Verified | Clarify the label |
| Low | Course detail | Two ways to view lessons: module previews on the detail page and the separate learner `LessonViewer` | `CourseDetail.tsx:27-29`; `CourseLearn.tsx:724` | Verified | Redesign later |
| Info | Routes | No broken course routes found. Old `/course/...` links redirect. People, Announcements, Assignments, Grades and Modules all share `CourseDetail` | `src/App.tsx:148-178,332-370` | Verified | None |

Working and integrated: wizard + AI, inline title and thumbnail editing, lesson and quiz editors, discussions (`InlineDiscussionWidget`), course messaging (`open_course_thread`), certificates (`check_course_completion`), calendar ICS.

## Gaps vs Teachable / Kajabi / Canvas / Blackboard
- Missing (searched for, nothing found): coupons, pricing and checkout, cohorts, real drip scheduling, SCORM/LTI import, bulk curriculum import, gradebook CSV export and import, builder-level student management and reports.
- Partial: prerequisites (no authoring), video analytics (no recording).

## Recommended order
1. Remove the fake buttons: make Export generate a real CSV, and hide the Drip badge until scheduling exists. (Incremental)
2. Pick one grading data source. Retire `gradeService` paths that use `grades` (rename with OLD).
3. Rename the unused progress and content hooks with OLD. Confirm with typecheck and the course E2E specs.
4. RLS and RPC audit of courses, content_items, submissions and enrollments (read-only queries, run separately).
5. Redesign: real Students and Reports tabs in the builder (reuse the roster, `course_roster_stats` and the gradebook).
6. Redesign: one assessment paradigm (inline in the player), with the Canvas pages as deep links.
7. New features: drip scheduling, prerequisite authoring, video tracking in the player, then pricing and coupons.

## Not done
- No E2E suite run and no runtime click-through in this audit. RLS policies weren't inspected.
