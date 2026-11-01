<!-- ABOUTME: Test-to-page alignment review of the E2E suite against the live app. -->
<!-- ABOUTME: Lists each finding, its label (stale / weak pass / flaky / missing), and the fix or open item. -->

# E2E alignment report (2026-11-01)

Method: scanned all 121 specs for presence-only checks (`.or()` fallbacks,
swallowed `.catch`, `if (isVisible)` guards, always-true expectations,
conditional `test.skip`), then compared the flagged tests with the current pages.

## Fixed

| Spec | Test | Label | What was wrong | Fix |
|---|---|---|---|---|
| courses/course-management.spec.ts | students management is still a placeholder | Stale | Asserted Students was "Coming soon"; the roster now ships | Replaced with: Students opens a roster and the Enrolled count equals the list rows |
| courses/course-management.spec.ts | (new) Reports shows the same enrolled count as Students | Missing | Reports tab had no browser coverage | Asserts Overview + Module progression render and the Enrolled KPI matches the roster |
| journeys/audit-coverage-gaps.spec.ts | dashboard renders the sidebar and greeting | Weak pass | Regex `welcome|dashboard` matched the sidebar's "Dashboard" link, so it passed even if the page body broke | Asserts the page's own "Welcome back, NAME! ..." greeting |

## Reviewed and judged aligned

- `.catch(() => false)` uses in notifications-flow, messages, messaging-validation,
  career-quiz-results: inside `expect.poll` classifiers whose result is asserted, so failures still fail.
- notifications-flow "Mark all as read": both branches assert real outcomes.
- `toBeTruthy()` uses in admin specs: check HTTP `ok()` or a created id, not trivial truth.
- Events cluster, admin roster, career-quiz-results (failing last full run): 18/18 pass now with the existing seed; no change needed.

## Open (not changed this pass)

| Spec | Label | Note |
|---|---|---|
| blog/blog-reading-journey.spec.ts | Weak pass | Accepts "posts or empty state" and skips the open-post test when no posts exist; needs a seeded published post |
| career/career-pathway.spec.ts, courses/course-certificate.spec.ts, admin/admin-activity.spec.ts and others | Conditional skip | Skip depends on account data; they report as skipped, not passed |
| interview-prep-design/code-evaluation.spec.ts | Conditional skip | Skips when the AI service gives no verdict |
| Several "renders X page" tests (e.g. course-management first test) | Weak pass | Only check that some heading exists; sibling tests in the same file check real content |
| journeys/assignment-submission-feedback, portfolio/portfolio-explorer | Flaky | Seen flaky in the last full run; see run results below |
| Unit tests (`src/**/__tests__`) | Not reviewed | Not covered in this pass |
