# E2E Coverage Audit

Follow-up work for the `Audit the whole site for missing end-to-end test coverage`
task. This document records the surfaces evaluated and where each stands after the
audit pass.

## Method
1. Enumerated top-level routes from `src/App.tsx` and the sidebar in `AppSidebar.tsx`.
2. Cross-referenced against every spec under `e2e/**`.
3. For each surface not already covered by a **genuine** test (per the definition in
   `e2e/TEST-PLAN.md`), either added a new spec or listed it as a known follow-up.

## Coverage status

| Surface                                | Prior coverage | Action taken |
| -------------------------------------- | -------------- | ------------ |
| Notifications center                   | none           | `e2e/journeys/notifications-flow.spec.ts` |
| Course materials (Drive-style)         | none           | `e2e/journeys/course-materials-flow.spec.ts` |
| Quiz results per-week view             | none           | `e2e/journeys/quiz-completion-flow.spec.ts` |
| Instructor grading dashboard           | partial        | `e2e/journeys/grading-workflow-flow.spec.ts` |
| Profile → My Certificates              | none           | `e2e/journeys/profile-certificates-flow.spec.ts` |
| Blog public index                      | none           | `e2e/journeys/audit-coverage-gaps.spec.ts` |
| Certificate verify — invalid code path | none           | `e2e/journeys/audit-coverage-gaps.spec.ts` |
| 404 handling                           | none           | `e2e/journeys/audit-coverage-gaps.spec.ts` |
| Dashboard shell (signed-in)            | thin           | `e2e/journeys/audit-coverage-gaps.spec.ts` |
| Non-admin access to `/admin`           | none           | `e2e/journeys/audit-coverage-gaps.spec.ts` |

## Known follow-ups (still open)

These require additional seeded fixtures or upstream product decisions before a
genuine test can be authored. Each is a distinct roadmap candidate rather than a
silent gap.

- Portfolio public view — public URL structure varies per user; needs a seeded
  portfolio owner account.
- Interview prep — mock interview room join flow depends on scheduled sessions.
- Admin activity log filters + CSV export — requires an admin session and stable
  audit rows.
- Blog author draft → publish → tag filter — needs an instructor/author account
  with post-create permissions.
- Messaging round-trip between two users (send/receive/read) — needs two
  authenticated browser contexts running against the same DB.

Adding a spec for any of these must satisfy the acceptance criteria in
`e2e/TEST-PLAN.md § Acceptance criteria for a "genuine" test`.
