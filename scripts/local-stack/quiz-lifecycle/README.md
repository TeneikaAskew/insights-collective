# Learner quiz lifecycle mode: fixture-only source

These files are lane-owned and fixture-only. They do not edit the shared runner (`.github/workflows/e2e.yml`, `scripts/ci/check-isolated-workflow.mjs`, `scripts/local-stack/t09/*`). The T09 harness owner adds the mode to the shared files after a T09 runtime run is green on its exact head. Dispatch waits for integration review.

| File | Role |
|---|---|
| `preflight.mjs` | Fail-closed checks, run after the stack, functions and preview are up and **before any fixture write**: config parses, API/DB/app loopback with exact ports, effective listeners loopback-only, no relay, `score-quiz` answers through the gateway, preview serves this `dist`. |
| `fixture.sh`, `fixture.sql` | Dedicated synthetic learner, one unpublished course, 11 scenario quizzes (`allowed_attempts` 1, 2, NULL, 0, plus one timed). **No `quiz_submissions` rows.** No grant, policy, RLS or trigger change. Refuses a used stack, an empty password, a non-loopback DSN, and a failed mutating target guard. |
| `ledger.sql` | Read-only per-quiz ledger (session set read-only): attempts, answer rows, progress rows. No auth columns. |
| `../../../playwright.quiz-lifecycle.config.ts` | Own config: **no globalSetup, no globalTeardown, no webServer**, retries 0, no trace/video/HAR. Specs are `*.isolated.ts`, so the default config never matches them (checked: 0 listed). |
| `../../../e2e/quiz-lifecycle/session.fixture.ts` | In-memory sign-in of the dedicated learner through the real login page, a loopback-only egress gate (any non-loopback request fails the test), a network event log, the ledger reader and labelled screenshots. No storage state is written, no password is changed, no cleanup runs. |
| `../../../e2e/quiz-lifecycle/lifecycle.isolated.ts` | F1 to F6 and U1 to U3 (10 tests). |
| `tests/sql-selftest.sh` | LOCAL-SHIM: the fixture and contract on plain PostgreSQL plus the shim. Not a Supabase stack. |
| `tests/preflight-selftest.sh` | MOCKED: a FAKE `ss` and a fake loopback HTTP server prove every refuse path. Not a stack. |

## Labels

- `REAL-BACKEND`: F1 to F5. Nothing is altered between the browser and the stack.
- `REAL-BACKEND + FAULT(progress | transport | delay)`: F6 and U1 to U3. The server really runs and commits. Only what the browser receives is changed, using a fulfilled 500, `route.fetch()` then `abort()`, or a held `continue`.

They are reported in separate `describe` blocks and separate screenshot folders (`screens/real`, `screens/fault`). A FAULT result is never presented as a plain real run.

## Order in the integrated job (for the owner to add; not added here)

1. The existing shared steps, unchanged: policy check, owned network, `supabase start`, endpoint export, target guards, ports/mail checks, STAGE PRE, bootstrap, identities.
2. **Edge-runtime delta (owner-implemented, separately reviewed):** start the stack without `-x edge-runtime` for this mode only. The ports and listeners guards then expect exactly one more container: on the owned network and only it, with **no published host port**, reached only through `127.0.0.1:54321/functions/v1`. Then `supabase functions serve`, with the existing readiness probe.
3. Production build, `check-local-target.mjs dist`, then `vite preview --host 127.0.0.1 --port 8080 --strictPort`.
4. `node scripts/local-stack/quiz-lifecycle/preflight.mjs` (defaults only: `--dist dist --expect-ports 54321,54322,8080 --deadline 120`).
5. `scripts/local-stack/quiz-lifecycle/fixture.sh`
6. `npx --no-install playwright test -c playwright.quiz-lifecycle.config.ts`, with `QLC_EVIDENCE_DIR` set to a job-scoped path and `E2E_EVIDENCE_COMMIT=${{ github.sha }}`.
7. The existing key/token deletion, `stop --no-backup`, network removal and leftovers checks. Then `stack-checks.sh stage-evidence --require-all` over the inventory below only.

## Exact artifact inventory

| Path | Content |
|---|---|
| `tested-ids.txt` | HEAD, tree, parent (existing step) |
| `checks/preflight.txt` | preflight output plus `EXIT=` trailer (PASS/FAIL lines name only check, loopback host:port, reason) |
| `checks/fixture.txt` | fixture output plus `EXIT=` trailer |
| `ledger/*.tsv` | one or more per scenario: ids, attempt numbers, states, scores, timestamps, answer option ids, progress state. No email, no token, no DSN |
| `screens/real/*.png`, `screens/fault/*.png` | `<scenario>-<w>x<h>-<sha12>.png` at 1440x900, 768x1024, 390x844 |
| `playwright/results.json` | JSON reporter only |
| `egress.txt` | per test: title, count of aborted non-loopback requests (must be 0) |
| `MANIFEST.sha256` | written by `stage-evidence` |

**Excluded:** raw `supabase start` output, auth/GoTrue logs, functions or edge-runtime logs, preview logs, `playwright-output/` (it holds nothing, because trace, video and screenshot-on-failure are off), storage state. Failure tails go only through `stack-checks.sh redact`.

## Known risks for the first integrated run (not verifiable without the stack)

- **Expected console errors in FAULT tests.** The console-error fixture already ignores `net::ERR_FAILED` and the app's logger prefix. If its structural Supabase check counts an injected abort, that is a finding to report, not a reason to loosen the fixture.
- **Sidebar labels.** F5 and U3 navigate by the visible item title. If CourseLearn renders titles differently, the selector is corrected; the schedule stays the same.
- **Migrations.** The ledger assumes the migration set the integrated mode applies (for example #135's `start_quiz_attempt` access check). The owner pins that set; this source does not apply migrations.
