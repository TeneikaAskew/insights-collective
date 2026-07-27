# Course Platform — End-to-End Test Plan

This plan documents every user journey we run end-to-end against the live app,
the fixtures each journey needs, and the acceptance criteria a test must
satisfy to count as "genuine" (i.e. it exercises real behavior — not a
UI probe that trivially passes when the feature is broken).

## Environment & Fixtures

### Roles / accounts
| Role       | Env var                                    | Seeded default                          |
| ---------- | ------------------------------------------ | --------------------------------------- |
| Member     | `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD` | `e2e-member@insightscollective.org` / `TestPass123!` |
| Instructor | `E2E_INSTRUCTOR_EMAIL` / `..._PASSWORD`    | `e2e-instructor@insightscollective.org` (password required in env) |
| Admin      | `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`   | (env only)                              |

Missing role creds → the affected specs must `test.skip` with a **loud** message
naming the env var, never a silent pass.

### Reference course
`E2E_ENROLLED_COURSE_ID` (default `660e8400-e29b-41d4-a716-446655440001`,
"Introduction to Data Science") — the member is enrolled here.
`E2E_UNENROLLED_COURSE_ID` (default `...440002`) — used for negative-permission checks.

### Playwright projects
- `chromium-member` — most authenticated feature specs
- `chromium-instructor` — course-builder, grading, gradebook, rubrics
- `chromium-admin` — everything under `e2e/admin/**`
- `chromium-public` — auth flows, landing, legal, public portfolio, blog, survey
- `firefox` — cross-browser smoke on dashboard + course list
- `visual-*` — screenshot regression per role

## Acceptance criteria for a "genuine" test

A spec counts as genuine only if **all** hold:
1. It signs in as a real seeded user (or asserts the unauthenticated path).
2. It performs an action or asserts state that would break if the feature
   regressed — not just "an element with this class is present".
3. Round-trip persistence is verified: reload after a mutation and confirm
   the change survived (or use another observable proxy such as a DB-driven
   badge count).
4. Negative paths are exercised: unauthorized user, empty state, invalid
   input each have at least one assertion.
5. On missing seed data the spec `test.skip`s with a message that names
   the missing fixture. Silent `if (count > 0)` no-ops are forbidden.

## Journeys

### 1. Course calendar (`e2e/courses/course-calendar.spec.ts`, `course-calendar-sync.spec.ts`)
- Load `/courses/:id/calendar` as enrolled member → month grid renders,
  seeded assignments/quizzes/Zoom sessions appear on their real dates.
- Copy ICS feed URL → the copied URL responds with `text/calendar` and at
  least one `BEGIN:VEVENT` block matching a seeded event title.
- Unenrolled user → blocked with "must be enrolled" alert.

### 2. Course catalog & detail (`e2e/courses/course-list.spec.ts`, `course-detail.spec.ts`)
- `/courses` renders seeded published courses; category/level filters
  actually reduce the list (assert card count changes).
- `/courses/:id` shows the module tree, instructor name, description, and
  Enroll button for a non-enrolled account; Continue button for an enrolled one.

### 3. Course learn player (`e2e/courses/course-learn.spec.ts`)
- Enrolled student navigates lessons via curriculum rail; completing a
  lesson updates the sidebar checkmark and the progress bar (verified by
  reload).

### 4. Assignments — submission (`e2e/journeys/assignment-submission-feedback.spec.ts`)
- Text-entry submission: fill textarea → Submit → row appears in
  `assignment_submissions` (verified via reload of the "My submission" view).
- URL and file-upload variants are exercised where seed data supports them.

### 5. Assignments — grading (`e2e/journeys/grading-workflow-flow.spec.ts`)
- Instructor `/manage/assignments`: rows show real submitted/graded counts.
- Click Grade → SpeedGrader loads; grading a submission fires the
  `notify_student_on_grade` trigger (verified indirectly by the student
  seeing an "assignment_grade" notification on reload).

### 6. Quizzes — taking & results (`e2e/journeys/quiz-completion-flow.spec.ts`)
- Start attempt → answer questions → Submit → `quiz_submissions` row with
  `workflow_state='complete'` and a score exists (checked via the
  results view badge).
- `/courses/:id/quiz-results` renders student-mode ("Your best score…")
  and hides class-average badges. Instructor variant shows class averages.

### 7. Materials (`e2e/journeys/course-materials-flow.spec.ts`)
- Enrolled student sees folder/file tree; download button issues a signed
  URL request to Supabase Storage.
- Non-manager UI hides "New folder" / "Upload" controls.
- Unenrolled user sees the enrollment gate.

### 8. Notifications (`e2e/journeys/notifications-flow.spec.ts`)
- Header, tabs, and either items or the empty state render.
- Mark all as read persists after reload (Unread tab stays empty).
- Deleting a notification persists after reload.

### 9. Certificates
- After completing every published content item, the
  `auto_issue_certificate_on_progression` trigger writes a row into
  `certificates` with a `verification_code`.
- Public `/verify/:code` page shows the student name, course, and issue
  date; unknown code → clear error state; > 20 attempts / min → rate
  limited.

### 10. Messaging (`e2e/messaging/messaging-validation.spec.ts`)
- Inbox loads, tabs switch, New Conversation dialog opens and is
  disabled until a recipient is picked.
- Course-scoped `open_course_thread` RPC rejects a student messaging
  another student (verified through the disabled UI + RPC error).

## Coverage gaps flagged for the follow-up audit
- Profile — certificate list & download (tracked separately).
- Portfolio public view — content parity with editor.
- Interview prep — mock interview room join flow.
- Admin activity log — filters + export.
- Blog author flow — draft → publish → tag filter.

Each gap requires a spec that meets the acceptance criteria above before
the audit item can close.
