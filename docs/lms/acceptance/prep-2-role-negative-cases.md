# Preparation 2: role-by-device negative cases (proposals to carrier owners)

Proposed case text only. No file is added to any carrier by this lane; the named owner decides whether and where to adopt each case. Every case runs on the isolated loopback stack with synthetic actors, records API or SQL readback alongside the screenshot, and declares its viewport in the spec. Actors: Stu-A, Stu-B (students), Ins (owner instructor), Co (co-instructor), For (unrelated instructor, self-enrolled as a student in the course where noted), Adm (admin), Anon.

## N-C1 Co-instructor identity (candidate C1) — owner: Students/Reports (#167) with PR134 for the SQL tier

Precondition: Adm adds Co to the course through the real UI path `/courses/:id/instructors` (which writes `course_instructors`). Expected per current source: `is_course_instructor` reads `course_assignments`, so Co may receive neither `canEdit` nor instructor RLS reads.

| Step | Actor | Viewport | Assert |
|---|---|---|---|
| 1 | Adm | 1440 | add Co on `/courses/:id/instructors`; readback the row written and which table received it |
| 2 | Co | 1440, 768, 390 | open `/courses/:id/builder?view=students`; record PASS if the roster renders with the learners, FAIL with the exact denial if `canEdit` is false |
| 3 | Co | API | `GET /rest/v1/content_item_progressions?course scope` as Co; record row count vs Ins's count |
| 4 | For | API | same read; expected 0 rows after `20261101000000` is applied on the stack, non-zero on the live-equivalent snapshot (this is the T-05 control, recorded as such) |

Outcome rule: a FAIL at step 2 or 3 is the C1 defect for WP-02/WP-15 and is filed, not fixed, by this lane.

## N-C3 Enrolment into a draft course by direct API (candidate C3) — owner: Builder (#166) for the publish chain

| Step | Actor | Viewport | Assert |
|---|---|---|---|
| 1 | Ins | 1440 | create a course, leave it unpublished; readback `published=false, status='draft'` |
| 2 | Stu-A | 1440, 390 | `/courses/:id` shows the draft as unavailable (no enroll CTA); catalog does not list it |
| 3 | Stu-A | API | `POST /rest/v1/enrollments {course_id, user_id=self}`; expected refusal; **record the actual status**; a 201 is the C3 defect |
| 4 | Stu-A | API | if a row was created, `/courses/:id/learn` must still not expose draft items; readback `content_items` visible to Stu-A = 0 |
| 5 | Ins | 1440 | publish; Stu-A repeats 2 and 3 and now succeeds; unpublish; Stu-A's access per the T-58 decision (recorded, not assumed) |

## N-C6 Student insights cross-course (candidate C6, T-28) — owner: Students/Reports (#167)

| Step | Actor | Viewport | Assert |
|---|---|---|---|
| 1 | For | 1440, 768 | open `/courses/:id/insights` and `/courses/:id/insights/:studentId` for a course For does not teach; the page must not render another learner's name, progress or activity; record what renders |
| 2 | For | API | the underlying reads the page issues (progressions, quiz submissions, video analytics) return 0 rows for that course |
| 3 | Ins | 1440 | same routes render the learner; counts equal an independent SQL count |
| 4 | Stu-A | 390 | both routes refused or redirected; no learner data in the DOM |

Note: step 2 is expected to FAIL on the live-equivalent snapshot because of the global instructor clause; it is the T-05 control again and is recorded as such.

## N-C9 Reorder RPCs by foreign and anonymous callers (candidate C9, T-55) — owner: Builder (#166) with PR134 for the migration proposal

Reorder RPC authorization (T-55): fix in draft #202, not applied. Cases 2 and 4 check it once applied.

| Step | Actor | Assert |
|---|---|---|
| 1 | Ins | reorder sections in the builder; readback dense `position` 0..n-1 and `CourseDetail` module order after reload (also covers candidate C2, `week` vs `position`) |
| 2 | For | `POST /rest/v1/rpc/reorder_modules {p_course_id, p_module_ids}` on Ins's course; **record the status and whether positions changed**; expected after #202: refused, positions unchanged |
| 3 | Anon | same call; same recording |
| 4 | Ins | `reorder_content_items` with a permutation that omits one item and one that includes a foreign item; expected after #202: both refused, positions unchanged |

Outcome rule: a changed position in step 2 or 3 is filed for PR134 as a migration proposal (new version, caller and permutation checks), not patched in the test.

## Device rule for every case above

Desktop 1440x900 is required for each API step's paired screenshot; 768x1024 and 390x844 are required where the row says so and must be declared with `test.use({ viewport })` in the spec, not inherited from a project default. Responsive components may mount both presentations; reads use `:visible` or `.filter({ visible: true })`.
