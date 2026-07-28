# Required updates

Ranked by user impact. **Product defects** break the app; **test defects** let it
break silently. Sizes are rough implementation estimates, excluding review.

---

## P0 — Product defects users hit today

### 1. `/courses/:courseId/progress` fails to load — all roles · S

`src/components/course/CourseProgressOverview.tsx:78` embeds
`modules(id, title, description, order_index, unlock_at, prerequisites_met)`.
`modules` has `position`, not `order_index`, and has neither `unlock_at` nor
`prerequisites_met`. Every load returns `42703`.

Decide per column: `order_index` → `position`; `unlock_at` and
`prerequisites_met` either drop or add to the table. `modules` already has
`prerequisite_module_ids`, so the intent may be recoverable rather than new.

### 2. Instructors cannot grade any assignment · M

`src/pages/CanvasGradingInterface.tsx:79` embeds
`user:profiles!user_id(...)` on `assignment_submissions`, whose `user_id` FK
points at `auth.users`. The page renders *"Error loading submissions"* for
instructors and admins. This is the grading workflow — nothing can be graded
through the UI.

### 3. `/courses/:courseId/modules/:moduleId/assignments/:assignmentId` fails · M

`src/services/assignmentService.ts:103` (and `:275`) embed
`student:profiles!user_id`. Same cause, same fix. Renders *"Failed to load
assignment"* for every role.

### 4. Root cause for 2 and 3: the `profiles` embeds cannot work · M–L

Eleven tables FK their user column to `auth.users`. PostgREST will never resolve
a `public.profiles` embed through them.

Three options, in order of preference:

1. **Add `user_id → profiles(id)` foreign keys** where `profiles.id` already
   mirrors `auth.users.id`. One migration fixes all sites at once and the embeds
   start working as written. Verify the mirroring holds for every row first.
2. **Two-query + join in the client**, as `useCourseEnrollments.ts` already does
   (fetch rows, then fetch profiles by id). No schema change; more code.
3. **A view or SECURITY DEFINER function** per surface.

Whichever is chosen, apply it to all eleven tables at once — the same embed is
spelled three different ways across the codebase (`profiles(...)`,
`profiles!instructor_id`, `profiles!courses_instructor_id_fkey`), so a partial
fix leaves a subset broken and indistinguishable.

---

## P1 — Product defects that are latent or degrade quietly

| # | issue | size |
|---|---|--:|
| 5 | `/courses/:courseId/quiz-results` selects `profiles(id, full_name, email)`; neither column exists. Does not fire on the default path, so no user has hit it yet — but the code path is live. | S |
| 6 | `/courses/:courseId/insights` embeds `profiles` on `video_analytics` — same root cause as #4. | S |
| 7 | `/interview-prep/mock-interview-room` with no `:sessionId` queries `mock_sessions?id=eq.undefined` → `22P02`. Page degrades gracefully; the request should not be issued. | S |
| 8 | `select_random_questions` RPC does not exist. Called from `questionBankService.ts:305`. Its unit test mocks the name, so 893 unit tests stay green. No live caller — delete the method or write the function. | S |
| 9 | `star-practice` and `portfolio-explorer` issue `.single()` where zero rows is normal, producing `406`/`PGRST116` on every load for users without that data. Use `maybeSingle()`. | S |
| 10 | `src/pages/CodePractice.tsx` is never routed and does `select('*')` on `code_challenges`, which has column-level-only grants (→ `42501`). Dead — delete it and its unused `App.tsx:58` import. | S |
| 11 | 13 broken shapes sit in unreachable modules (forums, `PeerReviewSystem`, `blogServiceV2`, legacy `MockInterviews`). They are harmless now and will break on revival. Decide: delete, or fix with #4. | M |

---

## P2 — Test defects: the suite cannot see failure

| # | issue | size |
|---|---|--:|
| 12 | Narrow the two remaining blanket suppressions in `console-errors.fixture.ts` (`/\/rest\/v1\//`, the logger-prefix regex). **Do this after #14** — they are compensating for the placeholder fixtures, so removing them first buries real defects in known noise. | S |
| 13 | 165 `if (count > 0) { expect }` guards make a missing element a *pass*. Convert to a real assertion, or to `expect.poll`, or delete the test. Biggest concentrations: `assignments/` (23), `admin/` (35), `courses/` (30). | L |
| 14 | Nine `TestIds` defaults in `e2e/helpers/route-helpers.ts` are non-UUID placeholders (`test-module-id`, `test-quiz-id`, `test-thread-id`, `test-rubric-id`, `test-portfolio-page-id`, …). Specs built on them assert against Not Found pages. Seed real rows and point the defaults at them. | M |
| 15 | 13 PostgREST writes asserted on `res.ok()` alone with `return=minimal`. `instructor-to-student-smoke.spec.ts:~299` grades an assignment this way; two sibling specs already do it correctly with `return=representation`. | S |
| 16 | 16 tests never execute — 13 unauthenticated-redirect tests `test.skip` under an authenticated project (they need their own signed-out project or `test.use({storageState: …})`), 2 career-pathway tests skip on data, 1 runs as the wrong role. | M |
| 17 | 5 specs mutate the database with no cleanup; `notifications-flow` permanently deletes a notification each run and will eventually fail on the seed gap it created itself. | M |
| 18 | Two member identities in one suite: `E2E_MEMBER_EMAIL` vs `E2E_TEST_EMAIL ?? 'test@insightscollective.org'`, and `E2E_TEST_EMAIL` is set nowhere. Five specs use the second. | S |
| 19 | `interview-prep-design/soft-studio-hub.spec.ts` asserts logged-out copy in 4 of 5 describe blocks while running under `chromium-member`. One block already pins itself signed out; the others should too. | S |
| 20 | 28 assertions check only the layout shell or a non-empty body. These are the tests that passed while the three P0 pages rendered errors. | M |

---

## Suggested sequence

1. **#4** — the FK decision unblocks #2, #3, #6 and most of #11.
2. **#1** — independent, small, and it is a fully broken page.
3. **#14 then #12** — real fixtures first, then remove the suppressions; now the
   suite can actually fail.
4. Re-run the full suite. Expect a wave of new failures: those are #13 and #20
   surfacing, and each one is a page that was never really covered.
5. Work #13/#20 down by area, starting with `assignments/` and `courses/`, which
   have both the weakest assertions and the P0 pages.
