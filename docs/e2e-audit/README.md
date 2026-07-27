# E2E and query audit

**The suite reports ~525 passing. That is not 525 verified behaviours.**

Three routes render an error page to real users right now, and the suite is green
across all of them. Two of the three have dedicated specs that pass while the
page they test is broken.

- [`required-updates.md`](./required-updates.md) — what to change, ranked
- [`queries.md`](./queries.md) — every query, replayed, with verdicts
- [`specs.md`](./specs.md) — all 99 specs scored
- [`methodology.md`](./methodology.md) — how this was produced, and where it can be wrong

---

## Confirmed broken in the browser

Observed failing for signed-in users, with the error text the user sees.

| route | roles | user sees | cause |
|---|---|---|---|
| `/courses/:courseId/progress` | member, instructor, admin | *"Failed to load course progress"* | `CourseProgressOverview.tsx:78` embeds `modules(order_index, unlock_at, prerequisites_met)` — none of those columns exist → `42703` |
| `/courses/:courseId/modules/:moduleId/assignments/:assignmentId` | member, instructor, admin | *"Failed to load assignment"* | `assignmentService.ts:103` embeds `student:profiles!user_id` → `PGRST200` |
| `/courses/:courseId/assignments/:contentItemId/grade` | instructor, admin | *"Error loading submissions"* — **instructors cannot grade** | `CanvasGradingInterface.tsx:79` embeds `user:profiles!user_id` → `PGRST200` |

The specs covering these pass: `course-progress.spec.ts` 4/4,
`grading-interface.spec.ts` 7/7. They assert `main` is visible and that no
spinner remains — both true on an error page.

## One root cause behind most of it

**Eleven tables FK their user column to `auth.users`, not `public.profiles`.**
PostgREST cannot resolve a `profiles` embed through them, so every such embed
fails for every role, always — 14 of the 21 broken shapes.

`certificates`, `assignment_submissions`, `blog_posts`, `content_discussions`,
`video_analytics`, `mock_sessions`, `threads`, `posts`, `peer_reviews` all point
at `auth.users`; `course_assignments` and `course_instructors` have no user FK at
all.

Only three of those embeds are on live routes today (the two above plus
`/courses/:courseId/insights`). The rest sit in dead code — which is why this has
gone unnoticed, and why it will keep biting as that code is revived.

## Why the suite could not see any of it

`e2e/fixtures/console-errors.fixture.ts` suppressed **every** `/rest/v1/` failure
via one catch-all, and 110 of the app's 187 logger prefixes via another. With
those in place a page could 400 on every request and still pass.

A recorder (`E2E_AUDIT_CONSOLE=1`) now logs everything, suppressed or not. Across
one full suite run it captured **1,600 records — 585 suppressed console errors
and 55 failed responses.** Of those 55, eight were this genuine defect firing
inside a passing test; the rest were placeholder fixtures and expected negatives.

## What the specs actually assert

| | count |
|---|--:|
| specs / tests | 99 / 509 |
| `if (count > 0) { expect }` guards — missing UI passes green | **165** |
| `test.skip` declarations | **23** |
| assertions that only check the layout shell or a non-empty body | **28** |
| PostgREST writes asserted on status alone, never re-read | **13** |
| specs that mutate the database with no cleanup | **5** |

Sixteen tests never execute at all: 13 "unauthenticated user is redirected" tests
`test.skip` under an authenticated project, two career-pathway tests skip on
missing data, one member-redirect test runs as instructor.

## Fixed while auditing

These were instrument and fixture defects — fixing them was a prerequisite for
trusting any measurement.

- `global-setup` wrote an **empty** storageState and continued whenever a sign-in
  failed, silently turning ~60 member specs into signed-out smoke tests that
  still passed. It now verifies the app persisted the session and fails the run
  otherwise.
- The announcement sweep printed unconditional success over unchecked deletes —
  the same bug the sweep beside it documents having fixed.
- `legal`, `survey`, `blog` and `public-portfolio` matched both
  `chromium-member` and `chromium-public`: ~44 test executions ran twice,
  authenticated and not, asserting the same things either way.
- `seed.sql` was **not idempotent** despite claiming to be — `ON CONFLICT DO
  NOTHING` on a constraint that does not exist appended a duplicate
  `Welcome.pdf` every run (measured 1 → 2). It also asserted nothing about its
  own inserts; it now requires the enrollment, the certificate, exactly one
  material file, and an instructor on the fixture course.
- Staff could revoke a certificate but not issue one, so the admin Certificates
  tab could destroy a credential with no way to restore it.
- `npm run visual` / `visual:update` named four projects that do not exist.

## Caveats

`src/integrations/supabase/types.ts` is stale and produced a **~40% false-positive
rate** when used to check queries. Nothing in this audit relies on it.

The static and reachability passes over-report on their own. Three of the four
findings first flagged as "broken on a live route" turned out to sit behind role
or tab conditions and never fire — `/courses/:id/quiz-results` renders correctly
for every role despite containing a `42703` select. Only the browser sweep
settles that, and only the CONFIRMED rows above are asserted as user-facing.
