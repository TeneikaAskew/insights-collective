# Preparation 3: triage of the 123 Playwright specs on `main` 82a97196 for the non-LMS smoke (R11)

Read-only inventory for the coordinator, who owns `e2e.yml`. Nothing here is a spec change. Classification is by what the file does with the production project ref and by which storage state its project needs.

## Verified count (programmatic classification over `find e2e -name '*.spec.ts'`, 123 files; classes are disjoint and sum to 123)

| Class | Count | Members |
|---|---|---|
| R11 candidate: non-LMS smoke, no production ref or env-fallback only | 55 | the list in "R11 candidate set" below (public 20, member 35) |
| Admin project (`admin/**`): runnable with the env set; R11 only after admin surfaces have owners | 18 | all of `e2e/admin/*` (three use the env-fallback pattern) |
| LMS lane specs: carrier-owned, not part of R11 | 35 | `courses/*` (13 of 16), `assignments/*` (6 of 7), `journeys/*` (12 of 17), `instructor/*` (3), `career/career-quiz-results` counted under journeys |
| BLOCKED: hard-coded production ref, no env override | 4 | `assignments/feedback-notifications`, `journeys/course-creation-full-coverage`, `journeys/course-messaging-e2e`, `journeys/messaging-notifications-hardening` |
| BLOCKED: external provider contract (isolated stack serves loopback placeholders) | 3 | `career/bls-wages-api`, `interview-prep-design/code-evaluation`, `interview-prep/mock-interview-booking` |
| BLOCKED: production by design | 1 | `navigation/live-visibility-config` |
| ISOLATED-WIRED on `main` (`readonly-courses`) | 3 | `courses/course-list`, `courses/course-detail`, `evidence/frontend-evidence` |
| ISOLATED-ONLY: destructive journeys, never live | 2 | `journeys/certificate-generation`, `journeys/full-completion-sequence` |
| ISOLATED-ONLY: creates a real account | 1 | `auth/real-signup-and-login` |
| INFORMATIONAL: visual baselines from the hosted era | 1 | `visual/visual-regression` |

Env-fallback pattern (`process.env.VITE_SUPABASE_URL || '<production>'`): 13 spec files plus the five shared fixtures; safe under the isolated job because the variable is set and the guard refuses otherwise. Two R11 candidates (`career/assistants`, `career/assistant-interface`) reach the fallback through `helpers/visibility-helpers.ts`.

## Key facts

- Shared fixtures (`e2e/global-setup.ts:26`, `e2e/fixtures/seed-check.ts:15`, `e2e/fixtures/console-errors.fixture.ts:311`, `e2e/helpers/visibility-helpers.ts:37`, `e2e/journeys/_helpers/signIn.ts:7`) use the production ref **only as a fallback when `VITE_SUPABASE_URL` is unset**. Under the isolated job the variable is set to loopback, and `assert-safe-target.mjs --mutating` refuses the run if it is not. These fixtures are therefore not blockers.
- 13 spec files carry the ref as the same env-fallback pattern: runnable under the isolated job as long as the env is set (they still need their data and role sessions).
- 4 spec files hard-code the production ref with **no env override**: `assignments/feedback-notifications.spec.ts:15`, `journeys/course-creation-full-coverage.spec.ts:9`, `journeys/course-messaging-e2e.spec.ts:14`, `journeys/messaging-notifications-hardening.spec.ts:7`. These would address production from inside an isolated run and are **BLOCKED** until their owners re-point them. They are not re-pointed by this lane.
- `navigation/live-visibility-config.spec.ts` deliberately checks production visibility configuration; BLOCKED for isolated runs by design.
- The two destructive journeys (`journeys/certificate-generation`, `journeys/full-completion-sequence`) reset certificates and progressions for the journeys account; isolated-only, never live.
- No tablet or mobile project exists; specs that declare 390 or 768 internally are listed with that width.

## R11 candidate set (runnable under the isolated job with the env set; owners confirm data needs)

Public project (`chromium-public`, signed out):
- `auth/auth-callback`, `auth/login`, `auth/mobile-overflow-signed-out` (390x844), `auth/public-route-queries`, `auth/redirect-state`, `auth/register`, `auth/reset-password`
- excluded: `auth/real-signup-and-login` (creates a real account; isolated-only with cleanup, not in the smoke)
- `landing/home-page`, `landing/index`, `landing/mobile-text-overlap` (390)
- `legal/privacy-policy`, `legal/terms-of-service`
- `survey/*` (3)
- `blog/blog-post`, `blog/blog-reading-journey` (skips when no posts; seed needed)
- `portfolio/public-portfolio`
- `career/career-pathway-public`
- `interview-prep-design/soft-studio-hub` (20 tests)

Member project (`chromium-member`, member storage state from global-setup):
- `dashboard/dashboard` (includes a 390 case; also the Firefox project)
- `navigation/layout`, `navigation/sidebar`, `navigation/theme-toggle`, `navigation/route-parity`, `navigation/session-flows`, `navigation/page-visibility` (route stubs)
- `resources/resources`, `resources/social-archives` (route stubs)
- `events/events`, `events/event-detail`
- `interview-prep/interview-prep-home`, `interview-prep/star-practice`, `interview-prep/mock-interviews`, `interview-prep/job-description`, `interview-prep/code-practice`
- `career/assistants`, `career/assistant-interface` (use visibility-helpers with env fallback), `career/career-pathway`, `career/explore-data-careers` (route stubs), `career/resume`, `career/bls-wages` (not the `-api` contract spec)
- `profile/profile`, `notifications/notifications`, `messages/messages`, `messaging/*` (2), `calendar/calendar`, `layout/mobile-overflow` (390; manifest paths only)
- `portfolio/portfolio-editor`, `portfolio/portfolio-explorer`
- `resume-design/soft-studio` (skips unless the dev preview route is served)
- `stubbed/app-sidebar-names` (fully stubbed, 1180x757)

Admin project (`chromium-admin`): the 18 `admin/**` specs are runnable with the env set; three (`admin-certificates`, `admin-completion-report`, `admin-instructor-roster`) rely on the env fallback and on seeded data; several skip without data. Recommended for R11 only after the LMS admin surfaces have owners.

Instructor project: LMS journeys, not part of the non-LMS smoke; covered by the carrier lanes.

## BLOCKED for isolated runs until re-pointed by their owners

`assignments/feedback-notifications`, `journeys/course-creation-full-coverage`, `journeys/course-messaging-e2e`, `journeys/messaging-notifications-hardening` (hard-coded production ref); `navigation/live-visibility-config` (production by design); `career/bls-wages-api`, `interview-prep-design/code-evaluation`, `interview-prep/mock-interview-booking` (external-provider contracts; isolated stack serves loopback placeholders, so they would skip or fail honestly, not pass).

## Visual project

`visual/visual-regression` has 3 baselines from the hosted era (2026-08-14); relay/isolated runs block fonts, so it must not be run with `--update-snapshots` and its result is informational only.

## Receipt rule for R11

The job summary must list, by spec and test title, executed / skipped (with the reason string) / failed. A skipped signed-in spec is not a pass.
