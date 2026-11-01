# Learner quiz lifecycle mode: fixture-only source

**Status: NOT RUN.** No case in `lifecycle.isolated.ts` has been executed against any stack. A `playwright --list` of it, a source count or a case list is not a test pass. The only things that have run are the self-tests below, each labelled with its tier.

These files are lane-owned and fixture-only. They do not edit the shared runner (`.github/workflows/e2e.yml`, `scripts/ci/check-isolated-workflow.mjs`, `scripts/local-stack/t09/*`). The T09 harness owner adds the mode to the shared files after a T09 runtime run is green on its exact head. Dispatch waits for that integration review.

| File | Role |
|---|---|
| `preflight.mjs` | Fail-closed checks, run after the stack, functions and preview are up and **before any fixture write**: config parses, API/DB/app loopback with exact ports, effective listeners loopback-only, no relay, `score-quiz` answers through the gateway, preview serves this `dist`. |
| `local-dsn.mjs` (+ `.d.mts`) | Strict local DSN handling: `assert-local-dsn` first, then URI form only, no query or fragment, host `127.0.0.1`/`localhost`, explicit port, plain identifiers, both parsers agree. Splits into a password-free URI (safe for argv) and the password (PGPASSWORD only). `derive <db>` requires a canonical maintenance URI (database `postgres`). Reads the DSN from **stdin**, never argv. |
| `fixture.sh`, `fixture.sql` | Dedicated synthetic learner, one unpublished course, **16 scenario quizzes**. **No `quiz_submissions` rows.** No grant, policy, RLS or trigger change. The DSN comes only from `SUPABASE_DB_URL` (a positional DSN is refused); refuses an empty password, a non-strict-local DSN, an unreadable source and a failed mutating target guard, all before psql. The DB password reaches psql only through `PGPASSWORD`, the synthetic learner password only through psql's stdin; both producers are checked (`PIPESTATUS`). psql output is captured privately and never forwarded; only the fixture's own notice or RAISE text and a byte count print. |
| `ledger.sql` | Read-only per-quiz ledger (session set read-only): attempts, answer rows with correct/points and row timestamp, progress rows. No auth columns. |
| `browser-egress.mjs` (+ `.d.mts`) | Chromium args for egress layer 1: dead proxy `127.0.0.1:9` and a resolver that maps every name except loopback to NOTFOUND. |
| `../../../playwright.quiz-lifecycle.config.ts` | Own config: **no globalSetup, no globalTeardown, no webServer, no storageState**, retries 0, workers 1, trace/video/screenshot off, `serviceWorkers: 'block'`, the egress args. Specs are `*.isolated.ts`, so the default config never matches them. |
| `../../../e2e/quiz-lifecycle/session.fixture.ts` | In-memory sign-in through the real login page; the layered egress gate; `forwardApproved()`; the network event log; `readLedger()` (strict DSN validation before psql, stderr withheld); `expectFinalized()`, `expectProgressRead()`, `attemptHistory()`; state-checked `snapshot()` and `interactionShot()`. |
| `../../../e2e/quiz-lifecycle/lifecycle.isolated.ts` | The cases below. NOT RUN. |
| `tests/sql-selftest.sh` | LOCAL-SHIM self-test (plain PostgreSQL + shim, not a Supabase stack). |
| `tests/isolation-selftest.sh` | MOCKED self-test with a fake psql. |
| `tests/egress-selftest.sh`, `tests/egress.selftest.ts`, `tests/playwright.egress-selftest.config.ts` | MOCKED self-test in a real Chromium against local stand-in servers. |
| `tests/preflight-selftest.sh` | MOCKED: a fake `ss` and a fake loopback HTTP server prove every refuse path. |

## Egress, in layers (any violation fails the test)

1. Browser: non-loopback destinations go to a dead proxy and cannot resolve; service workers are blocked (`register()` resolves without creating a worker, measured). This holds for redirects, new pages and workers, not one page.
2. Context `route('**/*')`: every request of every page needs an **exact approved origin** (scheme, host and port of `E2E_BASE_URL` and `VITE_SUPABASE_URL`); otherwise aborted and recorded.
3. Observers: any redirect hop, any 3xx response, any additional page and any service worker are violations.
4. A fault handler that forwards a request itself uses `forwardApproved()`: exact origin check **before** `route.fetch`, `maxRedirects: 0`, a 3xx is refused.

## Persisted acceptance (central helpers)

- `expectFinalized(ledger, s, [{attempt, q1, q2}])`: exactly these attempt numbers, distinct ids, `complete` with `finished_at`, the fixture score, exactly two answer rows per attempt with the graded `correct` and `points` (`1.00`/`0.00`) the key implies, no extra attempt or answer row.
- `expectProgressRead(s)`: polls the ledger until the progression row is exactly `['read']` (the app's contract, `content_item_progressions.workflow_state`). Finalized cases also wait for a settled UI (answers loaded, no progress save pending, no progress error).
- `attemptHistory(ledger, n)`: attempt n's ledger row and every answer row verbatim, including the row timestamp; F3 and U1 compare it before and after the retake.

## Cases and labels

| Case | Label | What it proves |
|---|---|---|
| F1 | REAL-BACKEND | limit 1: one start, one finalized attempt, progress read, result after reload |
| F2 | REAL-BACKEND | resume: same attempt id and `started_at`, saved answer restored, timer within 5 s of the server-derived time left, before and after reload |
| F3 | REAL-BACKEND | old autosave settled, immediate retake, attempt 2 has 0 rows in DB and nothing checked in the UI for 2.5 s with no write, attempt 1 history unchanged |
| F4 x2 | REAL-BACKEND | `allowed_attempts` NULL and 0: three finalized attempts |
| F5 | REAL-BACKEND | A to B to A: each quiz holds only its own attempt and answer; no progress |
| M1 | REAL-BACKEND, viewport interaction 390x844 | the whole flow driven at 390x844, controls in viewport |
| F6 | FAULT(progress-write-500-before-db) | the first progress write is answered 500 by the test and never reaches the DB; result kept, scored once, Retry, ledger exactly `read`, UI settled |
| U1 | FAULT(start-committed-response-lost + reconcile-read-aborted-before-db) | retake start forwarded (commits), response replaced by a network error; first reconciliation read aborted before the DB; Retry adopts attempt 2 blank; attempt 1 history unchanged |
| U2 | FAULT(score-committed-response-lost + readback-aborted-before-db) | score-quiz forwarded (finalizes), response lost, read-backs aborted until released; blocked with no write or progress for 3 s; Retry confirms; scored once; progress read |
| U3 | FAULT(answer-write-held-before-forward) | first answer write held in the browser (not in DB while held); leave and return; the held write settles 2xx before score-quiz is sent; no write and no ledger change for 3 s after |
| R1 | FAULT(answers-read-500-before-db) | saved-answer restore fails: honest block, no radios, no new start or write, ledger unchanged; Retry restores the same attempt |
| R2 | FAULT(answers-read-500-before-db) | review answer read fails: no "Incorrect" and no "0/1"; Retry shows "Correct · 1/1" twice |
| R3 | FAULT(start-held-before-forward) | first start held while answers are repeated and the learner moves A to B to A: one start, one attempt on A, none on B, screen agrees with the ledger |

F5 and F6 are not proof of R1 to R3. Each FAULT case is in its own `describe` and its own screenshot tier.

## Screenshots

- `screens/responsive-snapshot/<real|fault>/<name>-<w>x<h>-<sha12>.png`: the SAME state resized to 1440x900, 768x1024 and 390x844, with the state and its critical controls asserted at every size. States: F1 result, F2 resume (active), F6 progress error, U1 start uncertain, U2 submit uncertain, R1 restore error, R2 review error.
- `screens/viewport-interaction/<name>-390x844-<sha12>.png`: states reached by interacting at 390x844 (M1 active, resume, result). These are not resizes.

## Order in the integrated job (for the owner to add; not added here)

1. The existing shared steps, unchanged: policy check, owned network, `supabase start`, endpoint export, target guards, ports/mail checks, STAGE PRE, bootstrap, identities.
2. **Edge-runtime delta (owner-implemented, separately reviewed):** start the stack without `-x edge-runtime` for this mode only. The ports and listeners guards then expect exactly one more container: on the owned network and only it, with **no published host port**, reached only through `127.0.0.1:54321/functions/v1`. Then `supabase functions serve`, with the existing readiness probe.
3. Production build, `check-local-target.mjs dist`, then `vite preview --host 127.0.0.1 --port 8080 --strictPort`.
4. `node scripts/local-stack/quiz-lifecycle/preflight.mjs` (defaults only: `--dist dist --expect-ports 54321,54322,8080 --deadline 120`).
5. `scripts/local-stack/quiz-lifecycle/fixture.sh`
6. `npx --no-install playwright test -c playwright.quiz-lifecycle.config.ts`, with `QLC_EVIDENCE_DIR` set to a job-scoped path and `E2E_EVIDENCE_COMMIT=${{ github.sha }}`.
7. The existing key/token deletion, `stop --no-backup`, network removal and leftovers checks. Then `stack-checks.sh stage-evidence --require-all` over the inventory below only.

## Exact artifact inventory (private, redacted)

| Path | Content |
|---|---|
| `tested-ids.txt` | HEAD, tree, parent (existing step) |
| `checks/preflight.txt` | preflight output plus `EXIT=` trailer |
| `checks/fixture.txt` | fixture output plus `EXIT=` trailer (notice line or RAISE text and a byte count; never psql output) |
| `ledger/*.tsv` | per scenario and checkpoint: ids, attempt numbers, states, scores, timestamps, answer option ids, correct, points, progress state. No email, no token, no DSN |
| `screens/responsive-snapshot/<tier>/*.png`, `screens/viewport-interaction/*.png` | as above |
| `playwright/results.json` | JSON reporter only |
| `egress.txt` | per test: title and violation count (must be 0) |
| `MANIFEST.sha256` | written by `stage-evidence` |

**Excluded:** raw `supabase start` output, auth/GoTrue logs, functions or edge-runtime logs, preview logs, `playwright-output/` (empty: trace, video and screenshot-on-failure are off), storage state. Failure tails go only through `stack-checks.sh redact`.

## Known risks for the first integrated run (not verifiable without the stack)

- **Expected console errors in FAULT tests.** The console-error fixture ignores `net::ERR_FAILED` and the app's logger prefix. If it counts an injected abort or 500, that is a finding to report, not a reason to loosen the fixture.
- **Sidebar labels.** F5, U3 and R3 navigate by visible item title. If CourseLearn renders titles differently, the selector is corrected; the schedule stays the same.
- **Number rendering.** R2 and F1 expect `Correct · 1/1`; if PostgREST returns `points` as `"1.00"` the text differs and the selector is corrected, not the grading.
- **Clock.** F2 compares the timer to the DB `started_at` with 5 s tolerance; browser and DB share the runner clock.
- **Loopback transport flake (measured in the egress self-test).** Chromium occasionally failed a loopback request with `ERR_PROXY_CONNECTION_FAILED` before the server answered. The self-test retries until the redirect is really received; in the lifecycle spec such a failure would surface as a test failure, not a pass.
- **Migrations.** The ledger assumes the migration set the integrated mode applies. The owner pins that set; this source does not apply migrations.
