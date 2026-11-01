# Learner quiz lifecycle mode: fixture-only source

**Status: NOT RUN.** No case in `lifecycle.isolated.ts` (18 with T62) has been executed against any stack. A `playwright --list` of it, a source count or a case list is not a test pass. The only things that have run are the self-tests below, each labelled with its tier.

These files are lane-owned and fixture-only. They do not edit the shared runner (`.github/workflows/e2e.yml`, `scripts/ci/check-isolated-workflow.mjs`, `scripts/local-stack/t09/*`). The T09 harness owner adds the mode to the shared files after a T09 runtime run is green on its exact head. Dispatch waits for that integration review.

| File | Role |
|---|---|
| `preflight.mjs` | Fail-closed checks, run after the stack, functions and preview are up and **before any fixture write**: config parses, API/DB/app loopback with exact ports, effective listeners loopback-only, no relay, `score-quiz` answers through the gateway, preview serves this `dist`. |
| `local-dsn.mjs` (+ `.d.mts`) | Strict local DSN handling: `assert-local-dsn` first, then URI form only, no query or fragment, host `127.0.0.1`/`localhost`, explicit port, plain identifiers, both parsers agree. Splits into a password-free URI (safe for argv) and the password (PGPASSWORD only). `derive <db>` requires a canonical maintenance URI (database `postgres`). Reads the DSN from **stdin**, never argv. |
| `fixture.sh`, `fixture.sql` | Exact counts: **1 synthetic learner, 5 courses (4 PUBLISHED + 1 PRIVATE control), 4 modules, 5 enrollments, 23 scenario quizzes (17 main, 6 T-62), 0 attempts.** The 4 published courses are the main course and T-62 courses 20, 22, 24, each with one module and one enrollment, because CourseLearn's first read is the courses row and the stored courses policies admit only published courses (H1, supported by source and LOCAL-SHIM, not observed in run 41359219343). The private (unpublished) control course has an enrollment and no module or content; the learner must still not read it. It is checked by the LOCAL-SHIM sql-selftest only and is NOT a browser case. **No `quiz_submissions` rows.** No grant, policy, RLS or trigger change. The DSN comes only from `SUPABASE_DB_URL` (a positional DSN is refused); refuses an empty password, a non-strict-local DSN, an unreadable source and a failed mutating target guard, all before psql. The DB password is exported by bash builtins in a subshell that `exec`s psql, so it is only in psql's process environment, never in any argv (no `env VAR=...`); the synthetic learner password reaches psql only through stdin. Both producers are checked (`PIPESTATUS`). psql output is captured privately and **never printed**: success prints a fixed line; failure prints a fixed message by code (`F01`-`F06`, `F08` (5 enrollments) and `F09` (4 published + 1 private course) for the fixture's own RAISEs, `F07` missing completion notice, `F00` anything else, `P01` producer) and a byte count. |
| `ledger.sql` | Read-only per-quiz ledger (session set read-only): attempts, answer rows with correct/points and row timestamp, progress rows, and for the quiz's course the learner's enrollment, progression-row and certificate counts (E/G/C). No auth columns. |
| `revoke-access.sh` | T-62 only: removes the synthetic learner's enrollment in ONE synthetic T-62 course (key 20, 22 or 24 only), so the real `can_access_quiz` denies `start_quiz_attempt`. Same guards and secret channel as `fixture.sh`; exactly one synthetic row or a fixed `V01` failure. |
| `browser-egress.mjs` (+ `.d.mts`) | `exactBypassList()`: `<-loopback>` (subtracts Chromium's implicit bypass of localhost, 127/8, ::1, 169.254/16 and fe80::/10) followed ONLY by the exact approved `scheme://host:port` entries. Plus a resolver rule as defence in depth. |
| `timer-oracle.mjs` (+ `.d.mts`) | F2 timer arithmetic: tolerance 3 s, one tick margin, minimum server elapsed 10 s. |
| `../../../playwright.quiz-lifecycle.config.ts` | Own config: **no globalSetup, no globalTeardown, no webServer, no storageState**, retries 0, workers 1, trace/video/screenshot off, `serviceWorkers: 'block'`. Launch options (with the browser-wide proxy) come from the session fixture. Specs are `*.isolated.ts`, so the default config never matches them. |
| `../../../e2e/quiz-lifecycle/session.fixture.ts` | In-memory sign-in through the real login page; the layered egress gate; `forwardApproved()`; the network event log; `readLedger()` (strict DSN validation before psql, stderr withheld); `expectFinalized()`, `expectProgressRead()`, `attemptHistory()`; state-checked `snapshot()` and `interactionShot()`. |
| `../../../e2e/quiz-lifecycle/lifecycle.isolated.ts` | The cases below. NOT RUN. |
| `tests/sql-selftest.sh` | LOCAL-SHIM self-test (plain PostgreSQL + shim, not a Supabase stack). Includes the learn-page readability controls: the learner reads the 4 published course rows, cannot read the private control, the courses policies are still the snapshot's 7 with none reading enrollments, T-62 course 20 stays readable after revoke while the start is denied, and the causal published-only negative (same course unpublished -> 0 rows while its questions stay readable). |
| `tests/isolation-selftest.sh` | MOCKED self-test with a fake psql. |
| `tests/egress-selftest.sh`, `tests/egress.selftest.ts`, `tests/playwright.egress-selftest.config.ts`, `tests/egress-causal-control.mjs` | MOCKED self-test in a real Chromium (headless shell) against local stand-in servers: a non-loopback "external" sink and an unapproved THIRD loopback port sink, both counting hits. Includes the causal control. |
| `e2e/quiz-lifecycle/readiness.ts`, `readiness-core.ts` | Positive readiness for every case: the navigation must complete and the app's OWN course GET (no extra request) must be 200 with the expected synthetic course id; then, in ONE browser-side snapshot, the expected path, the TARGET item's lesson heading (from fixture.sql), a visible ready player state (active, review or exhausted) and no visible loading marker. In-app navigation (`expectMounted`) takes the expected item and applies the same target check, so a player still mounted from the previous item never passes. Loading-marker absence alone is never readiness. Every miss, including an aborted navigation, throws one fixed `QLC-READINESS` line and nothing else: nav result token, route-template, expected-id and target-heading booleans, course GET status plus an allowlisted PostgREST code plus id_match, visibility of 4 fixed headings (h0 "Course not found" .. h3 "Couldn't start this quiz") and of the player state testids. Never a body, header, token, id, URL value, DOM text or screenshot. Generic failure capture and the runner stay with the shared owner. |
| `tests/readiness-selftest.sh`, `tests/readiness.selftest.ts`, `tests/playwright.readiness-selftest.config.ts` | MOCKED in a real Chromium against a loopback stand-in (8 cases): the ready page passes; the H1-predicted shape (406 PGRST116, "Course not found"; not observed in run 41359219343) throws the exact redacted line; causal control: the OLD loading-count-0 wait passes vacuously on that same page; an empty player fails; an aborted navigation yields `nav=aborted` with no raw error or URL; a readable course with the URL already on B but A's player still mounted fails; a wrong expected item fails; a real in-app A to B transition passes once B is ready. `QLC_CHROMIUM_EXECUTABLE` optionally points at a local browser binary. |
| `tests/timer-oracle-selftest.mjs` | Arithmetic control: a server-clock timer passes, a timer reset at reload fails once elapsed >= 10 s. |
| `tests/preflight-selftest.sh` | MOCKED: a fake `ss` and a fake loopback HTTP server prove every refuse path. |

## Egress, in layers (any violation fails the test)

1. Browser-wide and per context: the proxy is a **refusal listener owned by the test worker** (answers 403, never forwards, records only `host:port`), with bypass `exactBypassList(APPROVED_ORIGINS)`. Without a launch-level proxy Chromium's own background traffic follows the process environment's proxy settings (measured here), so the launch-level proxy is set too. Ordinary redirect hops, which route interception does not see after the initial URL, are confined by this layer alone. Nothing assumes any port is dead. Service workers are blocked (`register()` resolves without creating a worker, measured).
2. Context `route('**/*')`: every intercepted request needs an exact approved origin; otherwise aborted and recorded.
3. Observers: any redirect hop, 3xx response, additional page, service worker, or request reaching the refusal proxy is a violation.
4. Fault handlers forward with `forwardApproved()`: exact origin check first, sent from the test process with `redirect: 'manual'`, 3xx refused. It does not use `route.fetch()`, whose node-side proxy matching is domain-only and would send approved traffic to the refusal proxy.

Proof (MOCKED, real headless Chromium): approved -> 302 -> unapproved third loopback port, by fetch and by navigation, with the 302 actually served and received: 0 sink hits, the hop recorded at the refusal proxy. **Causal control:** the same navigation with `<-loopback>` removed reaches the sink (>= 1 hit). Link-local and metadata addresses are covered by the documented subtraction and are never probed.

**Browser build:** the mode expects Playwright's default headless shell (what CI launches). A full Chrome's background services produce refused requests to Google hosts (measured); they never leave, but the gate counts them as violations, so such a run fails closed.

## Persisted acceptance (central helpers)

- `expectFinalized(ledger, s, [{attempt, q1, q2}])`: exactly these attempt numbers, distinct ids, `complete` with `finished_at`, the fixture score, exactly two answer rows per attempt with the graded `correct` and `points` (`1.00`/`0.00`) the key implies, no extra attempt or answer row.
- `expectProgressRead(s)`: polls the ledger until the progression row is exactly `['read']` (the app's contract, `content_item_progressions.workflow_state`). Finalized cases also wait for a settled UI (answers loaded, no progress save pending, no progress error).
- `attemptHistory(ledger, n)`: attempt n's ledger row and every answer row verbatim, including the row timestamp; F3 and U1 compare it before and after the retake.

## Cases and labels

| Case | Label | What it proves |
|---|---|---|
| F1 | REAL-BACKEND | limit 1: one start, one finalized attempt, progress read, result after reload |
| F2 | REAL-BACKEND | resume: same attempt id and `started_at`, saved answer restored; reload only after server-derived elapsed >= 12 s; timer within 3 s of the server-derived time left; in-test control that a timer reset at reload fails |
| F3 | REAL-BACKEND | attempt 1 answered through real autosaves (both answers persisted, >= 1 successful write observed) before submit; every sent write matched to its terminal event; immediate retake; attempt 2 has 0 rows in DB and nothing checked in the UI for 2.5 s with no write; attempt 1 history unchanged |
| F4 x2 | REAL-BACKEND | `allowed_attempts` NULL and 0: three finalized attempts |
| F5 | REAL-BACKEND | A to B to A: each quiz holds only its own attempt and answer; no progress |
| M1 | REAL-BACKEND, viewport interaction 390x844 | the whole flow driven at 390x844, controls in viewport |
| F6 | FAULT(progress-write-500-before-db) | the first progress write is answered 500 by the test and never reaches the DB; result kept, scored once, Retry, ledger exactly `read`, UI settled |
| U1 | FAULT(start-committed-response-lost + reconcile-read-aborted-before-db) | retake start forwarded (commits), response replaced by a network error; first reconciliation read aborted before the DB; Retry adopts attempt 2 blank; attempt 1 history unchanged |
| U2 | FAULT(score-committed-response-lost + readback-aborted-before-db) | score-quiz forwarded (finalizes), response lost, read-backs aborted until released; blocked with no write or progress for 3 s; Retry confirms; scored once; progress read |
| U3 | FAULT(answer-write-held-before-forward) | first answer write held in the browser (not in DB while held); leave and return; every sent write, the held one first, matched by request identity to its own 2xx completion before score-quiz is sent; no write and no ledger change for 3 s after |
| R1 | FAULT(answers-read-500-before-db) | saved-answer restore fails: honest block, no radios, no new start or write, ledger unchanged; Retry restores the same attempt |
| R2 | FAULT(answers-read-500-before-db) | review answer read fails: no "Incorrect" and no "0/1"; Retry shows "Correct · 1/1" twice |
| R3 | FAULT(start-held-before-forward) | first start held; four repeated answer changes while held, each required to take effect, still one start; A to B to A: one attempt on A, none on B, screen agrees with the ledger |

| T62 x3 | REAL-BACKEND + ACCESS-REVOKED, viewport interaction 1440x900 / 768x1024 / 390x844 | after load, the synthetic enrollment is removed; the first answer gets a real access denial; blocking "Couldn't start this quiz" with the server reason and "No attempt was started and your answers were not saved", no radios, no Submit, no "Saved", Retry re-asks (second real denial); Continue only navigates to the next item; 0 attempts, 0 answers, 0 progression rows, 0 certificates, percentage text unchanged |
| T62 control | REAL-BACKEND | an authorized first answer on quiz 26 starts exactly one attempt and shows no refusal |

T62 needs BOTH the player follow-up (local 00b3c57 on eba62b0) and #135's migration 20261101000100 in the stack: the schema snapshot's `start_quiz_attempt` has no access check, so without that migration a revoked learner can still start (measured in the LOCAL-SHIM self-test as a control).

**Known product gap seen while writing T62 (not asserted, outside this lane):** CourseLearn's outer button for an unsubmitted quiz reads "Complete" below the `sm` breakpoint and its hint says "Mark this lesson done and continue", although for assessments it only navigates. T62 asserts the behaviour (navigation only, nothing persisted) and records screenshots; the label is for the user and CourseLearn's owner.

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
