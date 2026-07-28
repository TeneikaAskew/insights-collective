# Query validation

Every Supabase call the app makes, replayed against the live project as anon, member, instructor
and admin. 329 distinct shapes from 702 call sites over 97 tables, plus 24 RPCs.

| verdict | count |
|---|--:|
| OK | 303 |
| BROKEN | 21 |
| BLOCKED | 4 |
| MISSING | 1 |

## Broken shapes

`BROKEN` = every available role got the same structural error (42703 missing column, 42P01 missing
table, PGRST200 unresolvable embed). A 401/403 for anon on a members-only table is correct
behaviour and is *not* counted here.

| table | error | call site | reachable from | fires on load? |
|---|---|---|---|---|
| `assignment_submissions` | `PGRST200` | `src/pages/CanvasGradingInterface.tsx:79` | `/courses/:courseId/assignments/:contentItemId/grade` | yes — **CONFIRMED** |
| `assignments` | `PGRST200` | `src/services/assignmentService.ts:103` | `/courses/:courseId/gradebook` | yes — **CONFIRMED** |
| `courses` | `42703` | `src/components/course/CourseProgressOverview.tsx:78` | `/courses/:courseId/progress` | yes — **CONFIRMED** |
| `assignment_submissions` | `PGRST200` | `src/services/assignmentService.ts:275` | `/courses/:courseId/gradebook` | not on default path |
| `certificates` | `PGRST200` | `src/components/certification/CertificationSystem.tsx:97` | `/courses/:courseId/certificate` | not on default path |
| `certificates` | `PGRST200` | `src/pages/AdminCourses.tsx:576` | `/admin/courses` | not on default path |
| `content_item_progressions` | `42703` | `src/components/admin/CourseProgressDashboard.tsx:64` | `/admin/courses` | not on default path |
| `content_item_progressions` | `42703` | `src/components/admin/UnifiedExportReport.tsx:71` | `/admin/courses` | not on default path |
| `enrollments` | `42703` | `src/components/admin/CourseProgressDashboard.tsx:62` | `/admin/courses` | not on default path |
| `enrollments` | `42703` | `src/components/admin/UnifiedExportReport.tsx:69` | `/admin/courses` | not on default path |
| `profiles` | `42703` | `src/pages/CourseQuizResults.tsx:101` | `/courses/:courseId/quiz-results` | not on default path |
| `select_random_questions` | `no such function` | `src/services/questionBankService.ts:305` | `/courses/:courseId/question-banks` | not on default path |
| `video_analytics` | `PGRST200` | `src/services/videoAnalyticsService.ts:306` | `/courses/:courseId/insights` | not on default path |
| `blog_posts` | `PGRST200` | `src/services/blogServiceV2.ts:147` | `**dead code**` | n/a |
| `blog_posts` | `PGRST200` | `src/services/blogServiceV2.ts:179` | `**dead code**` | n/a |
| `blog_posts` | `PGRST200` | `src/services/blogServiceV2.ts:96` | `**dead code**` | n/a |
| `content_discussions` | `PGRST200` | `src/services/contentDiscussionService.ts:107` | `**dead code**` | n/a |
| `content_discussions` | `PGRST200` | `src/services/contentDiscussionService.ts:66` | `**dead code**` | n/a |
| `course_assignments` | `PGRST200` | `src/hooks/useCourseAssignments.ts:58` | `**dead code**` | n/a |
| `course_instructors` | `PGRST200` | `src/components/course/CourseInstructorsTab.tsx:61` | `**dead code**` | n/a |
| `course_settings` | `42P01` | `src/components/course/management/CourseSettings.tsx:56` | `**dead code**` | n/a |
| `mock_sessions` | `PGRST200` | `src/components/mock-interview/MockInterviewRoom.tsx:53` | `**dead code**` | n/a |
| `peer_reviews` | `PGRST200` | `src/components/assessment/PeerReviewSystem.tsx:99` | `**dead code**` | n/a |
| `posts` | `PGRST200` | `src/hooks/useForums.ts:85` | `**dead code**` | n/a |
| `threads` | `PGRST200` | `src/hooks/useForums.ts:48` | `**dead code**` | n/a |
| `threads` | `PGRST200` | `src/pages/ThreadDetail.tsx:27` | `**dead code**` | n/a |
