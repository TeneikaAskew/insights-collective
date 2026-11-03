# Lesson-editor acceptance fixture: source and plan for isolation review

**Status:** source only, on local branch `local/lesson-editor-fixture` (on the published composition 0e98de7, #142).
Nothing here has run against a real `supabase start` stack, nothing has been dispatched, and the shared workflow has not
been edited. Integration into the shared runner (`e2e.yml`, the checker) belongs to the T-09 owner; the snippet below is a
proposal only. **Held:** not qualified for execution until the isolation and acceptance reviews close.

**Purpose:** acceptance (WP-04/WP-08) of #142's lesson save and reload behaviour where mocks cannot reach: real TipTap, the
real version trigger and conditional fence, roles under real RLS, and the recovery screens at 1440x900, 768x1024, 390x844.

## Evidence tiers

| Tier | What | Status |
|---|---|---|
| Source and mocked | #142's Vitest suites | passed (1872 tests, PR Checks run 41324232146) |
| LOCAL-SIM | `tests/guards-selftest.sh`: a throwaway PG16 cluster it creates and removes, T-09's simulated managed layout, LOCAL-SHIM pg_net queue with the T-09 PRE guard, `bootstrap.sh`, then TCP switched to scram-sha-256 with a random password, RLS as role `authenticated` with JWT claims. HTTP probes hit a FAKE server and psql negatives a FAKE psql (both labelled) | 60/60, five causal controls below |
| LOCAL-BROWSER | `egress-selftest.spec.ts`: real Chromium against loopback test servers (no stack) | passes; three weakened controls fail as expected |
| LOCAL isolated stack | `backend-contract.mjs` (PostgREST + GoTrue, real persona JWTs) and `lesson-editor.spec.ts` (built app, Chromium) | **not run** |
| Deployed backend | none | **out of scope**; the deployed trigger stays unverified |

## Order of operations in `run.sh setup` (isolation 1 and 4)

1. **Harness pin first**: `api-http.mjs` (blob 3acd5b02, the shared contract on #162/#166/#167; was fb2b49d8 at T-09 `5d81976`,
   the only code change being the same-handle `readSecretFile` of 4a54ee4c) and `stack-checks.sh` (blob 9657af04) are hashed
   before any of their code runs. Any other content stops the run (self-test R14 proves the pin wins over a bad target).
2. **Self-test overrides refused** (`LE_ALLOWED_ORIGINS`, `LE_EGRESS_CONTROL`) in `setup` and `owner`, before any request,
   directory or write. The spec refuses both at load, and the egress fixture refuses `LE_ALLOWED_ORIGINS` whenever a
   lesson-editor target is configured, so the authentic allowlist is always exactly the app and API origins.
3. Target checks: password-free canonical loopback DSN, strict loopback API and app origins; private and evidence dirs
   absent and disjoint.
4. **`preflight.mjs`, read-only, before the first GoTrue admin POST** (P1-P4; GET requests only, read-only transaction):
   - P1 fresh synthetic stack: no non-synthetic account, no `le-*` persona yet, no `ed170000-*` row.
   - P2 queue guard: `net.http_request_queue` exists, T-09's `t09_drop_http_request` is on it and enabled, the queue is empty,
     `local_evidence.egress_attempts` exists. A LOCAL-SHIM queue is refused unless `LE_ALLOW_SHIM=1` (self-test only).
   - P3 API matches DB: GoTrue's user total and PostgREST's exact course count equal the database's, and PostgREST exposes
     the fixture tables and at least 90% of the database's public tables. **This is consistency, not identity**: two empty
     stacks agree. Authenticated identity pairing of the owned stack (API and DB from the same owned `supabase start`) is the
     shared owner's step before `setup` (see the integration proposal).
     **The exposure root is read with the SERVICE key** (`p3-exposure.mjs`). PostgREST's OpenAPI view lists only tables the
     requesting role holds privileges on, and anon deliberately holds none on `quiz_questions` (answer key hidden), so an anon
     root refused a correct stack (E1 run 41676587739). Nothing is granted to anon; `quiz_questions` stays required.
     No-network self-test: `node scripts/local-stack/lesson-editor/tests/p3-selftest.mjs` (in-process fake with a
     privilege-following root; the OLD anon-root P3, rebuilt from source, must refuse what the new P3 accepts).
   - P4 app matches API: the served entry bundle names exactly this API origin and no hosted `*.supabase.co` project.
5. Personas, fixture, LOCAL backend contract. Any failure after the private dir exists removes it (and `personas.mjs`
   removes its own partial output). GoTrue accounts already made stay, but the stack is disposable and P1 refuses reuse.

## Isolation: data, errors and evidence (isolation 3 and 6)

- **Private vs public.** Session files (`personas.json`, `state-*.json`) live only in the private dir (0700, files 0600).
  `backend-contract.json`, the Playwright report and output go to the evidence dir. The spec refuses to start unless its
  output and report are inside `LE_EVIDENCE_DIR` and that dir is disjoint from `LE_WORK_DIR`.
- **`run.sh evidence <dest> <evidence dir>`** refuses any session file under the evidence dir, then delegates to T-09's
  `stack-checks.sh stage-evidence --require-all` (credential-shape scan, exact copy, manifest, re-scan of the staged copy).
- **`run.sh cleanup <private dir>`** removes the private dir, only when it holds nothing but the expected file names.
  The integrated job should call it in an always-run step.
- **Traces, videos and automatic screenshots are off** (a trace would hold request headers and storage).
- **Database credentials.** Every DB URL is password-free (`postgresql://user@host:port/db`, checked by `pgconn.mjs` and
  the shared strict parser). The password, when needed, comes only from `LE_DB_PASSWORD_FILE` (absolute, regular, not a
  symlink, owned by the caller, no group or other bits, one line, at most 4 KiB). The OPENED handle decides: the open is
  read-only, no-follow and non-blocking, and fstat on that descriptor must show a regular file before any byte is read,
  so replacing the path after the check (a FIFO, a symlink) is refused instead of hanging. `tests/pgconn-selftest.mjs`
  (K1-K13, no database) proves it; its `blocking-open` control fails the regular-to-FIFO replacement case by hanging. Each invocation writes a private 0600 libpq passfile
  for exactly that host, port, database and user, names it to psql only in the child environment (`PGPASSFILE`), and
  removes it on exit. An external `PGPASSWORD` is refused by `run.sh`, `preflight.mjs` and the spec. psql always runs with
  `-w`, so a missing password fails closed instead of prompting.
- **Errors.** Child stderr is never printed, not even in part (the T-09 "probe" rule). A failure prints at most one FIXED
  code chosen by `run.sh` for a known fixture refusal, plus the exit status and byte count. `preflight.mjs` and
  `personas.mjs` replace harness and request errors with fixed messages. Spec `run.sh` errors carry the subcommand and exit status only. JSON parse errors are reported
  without content, and uncaught errors in the node scripts are replaced with a fixed message. Self-test F1-F7 plant a marker
  and a password-bearing DSN in fake stderr and output and prove neither is printed.
- **Bounded metadata.** Lesson ids in evidence are labels (`A`, `B`, `N`, `Q`, `K`, `KN`, `<other>`, `<none>`), never raw
  query text. The write condition is one of `eq`, `is.null`, `none` or `other`.

## Browser egress boundary (isolation 2)

`e2e/lesson-editor/egress-test.ts` wires four independent layers into every test (worker browser plus every context):

1. **Resolver**: the repository's shared hermetic rule plus one exclusion,
   `--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost,EXCLUDE 127.0.0.1`. **Finding:** on this Chromium (1243)
   `MAP *` also rewrites the 127.0.0.1 IP literal, contrary to the comment in `playwright.config.ts`. Without the
   exclusion the loopback app itself is unreachable. This is reported for the shared config's owner, not edited here.
2. **Allowlist proxy** (`egress-proxy.ts`): Chromium is launched through a loopback proxy with `<-loopback>`, so loopback
   goes through it too. Only the exact allowed origins are forwarded, transparently (nothing followed, cached, fulfilled or
   modified). Everything else gets a 403 before any upstream connection, including redirect hops, popups, second tabs and
   WebSocket CONNECT tunnels.
3. **Route and WebSocket filter** (`egress-boundary.ts`): `context.route` only aborts non-allowed origins or continues;
   `routeWebSocket` closes non-allowed sockets.
4. **Observation**: any non-allowed request, any redirect hop and any service worker is a violation that fails the test.
   `serviceWorkers: 'block'`.

**Self-test (real Chromium, loopback servers only).** It probes `fetch`, `img`, `sendBeacon`, a non-loopback hostname, a
redirect from the allowed origin to a forbidden loopback port, a WebSocket, a service worker, a popup, a second tab and a
top-level navigation.

| Run | Forbidden server hits | Result |
|---|---|---|
| all layers | 0 | pass. The proxy also refused Chromium's own background traffic (update and accounts services), which `page.route` never sees |
| `LE_EGRESS_CONTROL=off` | 11, every probe | fail (causal) |
| `route-only` (no proxy) | 1, the redirect hop | fail. **`context.route` alone misses redirects**, so the proxy is necessary |
| `proxy-only` (no route layer) | 0 | fails only the route-layer record check. The proxy alone already prevents egress |

Violation and refusal records carry only a reason and an origin. The lesson-editor spec refuses to run when
`LE_EGRESS_CONTROL` is set.

## Files

- **`preflight.mjs`**: read-only preflight (above).
- **`pgconn.mjs`**: the password-free DSN rule and private passfile (above).
- **`personas.mjs`**: OWNER (instructor, owns C1), OTHER (instructor) and STUDENT, created through the local GoTrue admin
  API via T-09's `api-http.mjs`. Passwords stay in memory. Writes `personas.json` and `state-<P>.json`, 0600, in a fresh
  0700 dir, and removes them on failure.
- **`fixture.sql`**: setup, once per fresh stack, no reset. Refuses without the acknowledgement, with any non-synthetic
  account, with a non-`le-*` persona id, or when C1 exists. Seeds C1 with pages A and B, page N with a NULL version (set by
  INSERT; the trigger is BEFORE UPDATE only), quiz Q with its `quizzes` row and 2 questions, and contract-only pages K and
  KN. No DDL, settings, deletes, or enrollment, submission, grade or history rows.
- **`backend-contract.mjs`**: LOCAL PostgREST checks in exactly the app's request shape:
  - C1 returned-version write changes 1 row, the trigger replaces the client stamp, and the returned row equals the stored row
  - C2 a stale version changes 0 rows
  - C3 the returned version works as the next condition
  - C4 the IS NULL fence: 1 row, then 0
  - C5 OTHER and STUDENT change 0 rows even with the exact current version (each read independently)
  - C6 the quiz type stays `quiz`
- **`run.sh`**: `setup`, `owner`, `read`, `quizhash`, `evidence`, `cleanup` (header). `quizhash` covers the quiz
  DEFINITION and its questions only.
- **`tests/guards-selftest.sh`**, **`tests/fake-stack-http.mjs`**, **`tests/mutate-runner.mjs`**: LOCAL-SIM self-test and its runner-copy controls (below).
  Note: `fake-stack-http.mjs` serves one root to every key, so it cannot see the anon/service difference; `tests/p3-selftest.mjs` covers that.
- **`e2e/lesson-editor/`**: `playwright.lesson-editor.config.ts` (scratch: no globalSetup/teardown/webServer, Chromium,
  1 worker, 0 retries, traces off), `lesson-editor.spec.ts`, `egress-test.ts`, `egress-boundary.ts`, `egress-proxy.ts`,
  `egress-selftest.spec.ts` and `playwright.egress-selftest.config.ts`.

## The spec: 17 tests, ALL UNRUN

The 17 tests are 9 functional, 2 role, 3 multi-state screen flows and 3 denied screens. Requests are tracked over the whole
context (every tab) from start to finished or failed; comparisons wait until the relevant writes have settled.

- **E1 save:** the settled write's returned row equals the DB row (`eq` condition, 1 row); the trigger advanced the
  version; a reload keeps the title. The body is judged EXACTLY by `e2e/lesson-editor/body-oracle.mjs`: the baseline is pinned
  to the fixture (`<p>Body A</p>`), and the returned row, the DB row and the reloaded editor must each normalize to the
  independently expected `Body A E1 body` (seeded + appended). A lost seeded text, a lost, duplicated or reordered append, or
  stray text fails. Markup identity beyond the text (paragraph split, marks) is not claimed. No-browser self-test:
  `node e2e/lesson-editor/body-oracle-selftest.mjs` (FAKE values; `--oracle old` shows what the earlier contains-check let pass).
- **E2 (oracle A):** navigation targets are resolved before the edit. Input, click and write start are all taken on ONE
  browser clock (`performance.timeOrigin + now`) by passive instrumentation installed before the first document: capture
  listeners and a fetch wrapper that records a timestamp and a bounded lesson label, then calls the original fetch
  unchanged. For both the lesson switch and Preview: the last title input before the click is under 800 ms earlier (a
  labelled PRECONDITION, not a persistence result), no write for that lesson left between the input and the click, and a
  NEW write started after the click and before input + 800 ms. The DB then holds the edit, and Preview's is checked as soon
  as the URL changes. **Same-lesson serialization under concurrent in-flight writes is NOT claimed.**
- **E3 (B):** offline gives uncertain "Save not confirmed". Retry while still offline stays unconfirmed, and every send
  is recorded as failed in the browser. The leave warning appears and Stay keeps the draft. Reconnecting triggers the
  builder's own online retry, which reconciles first, and the edit persists.
- **E4 (B), document loss:** while the send is unconfirmed, the durable record must be `v:2`, with the OWNER, the draft
  title, `uncertain: true` and a non-empty outstanding list. The tab then leaves the app **while still offline**, so the
  old document never settles. A fresh document restores, reconciles, saves, and clears the record. **The durable
  ambiguous case** (a send that may still commit while the author goes back to the base) **is NOT reproduced**, because
  offline sends never reach the server. It stays pending.
- **E5 (C):** requires a true NULL baseline. A second tab saves first with an observed `is.null` condition (1 row) and
  the trigger versions the row. The stale tab's save is observed still conditioned on `is.null`, matches 0 rows and
  becomes a conflict, with the DB unchanged; an unconditional writer would have overwritten it. Keep my version then
  resolves with an `eq` condition.
- **E6:** a second tab causes a conflict; the stale write matches 0 rows; Keep my version wins.
- **E7:** real RLS zero rows (observed 0 rows); no false success; retry works after access returns.
- **E8 (D):** the quiz type is fixed. The requested title is stored exactly in the DB (a dropped save fails here), the
  **quiz definition and its two questions** are unchanged, and a reload shows the stored title.
  **Existing student quiz history preservation and curriculum rename/publish side actions are NOT covered.**
- **E9:** deep link, reload, and a missing lesson.
- **R-OTHER, R-STUDENT (E):** Not authorized, and zero content_items writes **started** (pending and failed included),
  with the DB unchanged.
- **Screens (F)**, per viewport:
  - deep link
  - saved
  - not confirmed (DB still has the saved title, not the draft)
  - leave warning
  - restored after document loss
  - conflict (DB has the other tab's title)
  - fixed type
  - Not authorized for OTHER (no write started)

  Before each verified capture, the expected UI title, status, body or heading is asserted, writes are settled, and the
  database is checked to agree (title, and body where the frame claims one). A verified frame that reads the database
  without asserting a state is refused. The restore is two frames: **05a is OBSERVED ONLY** (UI asserted, no database
  claim, labelled so in its JSON), and **05b** is captured after Saved with the exact DB title. A later assertion never
  stands in for an earlier pixel. A PNG alone is never acceptance.

## Results here

- **`guards-selftest.sh`**, normal run: **60 passed**.
  - P0-P6 and P1a/P1b: preflight positives and negatives, setup stopping at preflight with zero POSTs, GET-only probes.
  - G1-G6: guards; personas and fixture enqueue nothing for pg_net.
  - S0-S8: trigger, condition, fence and RLS.
  - R1-R14: runner, cleanup, evidence staging, pin first.
  - F1-F9: fake-psql and parse negatives with no side effects, cleanup of partial personas, and a refusal-shaped stderr
    with a synthetic marker that yields only the fixed code.
  - D0-D7: the cluster refuses a passwordless connection; without the password file the runner cannot authenticate; a
    password-bearing DSN, an external PGPASSWORD and a loose or symlinked password file are refused; a capturing psql
    shows no password in argv, no PGPASSWORD, and a private 0600 passfile that is gone afterwards (run.sh and preflight).
  - O1-O3: setup and owner refuse the self-test overrides before any request, directory or write.
- **Controls** (each exits 1; the named checks fail): `no-trigger` S2; `no-rls` S6, S7, S8, R6; `no-override-guard` O1-O3;
  `stderr-echo` F9; `password-argv` D6. The last three run a copy of the lane mutated by `tests/mutate-runner.mjs` in a
  mirror tree.
- The cluster, database and temp files were removed after every run (checked).
- **No-trigger finding (unchanged):** the IS NULL fence still holds without the trigger, because the client writes
  `updated_at`. Versioned conflict detection would then depend on the client clock, so C1 and S2 must pass on a backend
  before claiming conflict safety there.

## Proposed shared-runner integration (for the T-09 owner; NOT applied)

This is one new `e2e.yml` dispatch option, `lesson-editor`. It reuses the qualified steps unchanged: Docker >= 28, the
owned per-mode loopback network, the ports guard, `workdir.sh` and `supabase start --network-id`, **`stage-pre.sh` (PRE
queue guard and sentinels) before** `bootstrap.sh`, and cleanup. Then:

1. Prove the API and the DB belong to the same OWNED stack (authenticated pairing from the owned workdir and network)
   before `setup`. The lane's P3 is only consistency. Keep the same app, guard and hermetic served build, and do not relax
   the egress guard for any editor CDN.
2. Write the anon and service keys, and the DB password if the stack needs one, to 0600 files.
3. Build the app against `http://127.0.0.1:54321` and serve it with `vite preview --host 127.0.0.1 --port 8080`.
4. Run `LE_DB_PASSWORD_FILE=<0600 file> run.sh setup http://127.0.0.1:54321 http://127.0.0.1:8080 postgresql://postgres@127.0.0.1:54322/postgres <anon> <service> $RUNNER_TEMP/le-private $RUNNER_TEMP/le-evidence`.
5. Run `npx playwright test -c e2e/lesson-editor/playwright.lesson-editor.config.ts` with:
   - `LE_APP_ORIGIN`, `LE_API_ORIGIN`, `LE_DB_URL` (password-free), `LE_DB_PASSWORD_FILE`
   - never `LE_ALLOWED_ORIGINS`, `LE_EGRESS_CONTROL` or `PGPASSWORD` (each is refused)
   - `LE_WORK_DIR=$RUNNER_TEMP/le-private`
   - `LE_EVIDENCE_DIR=$RUNNER_TEMP/le-evidence`
   - `LE_OUTPUT_DIR` and `LE_REPORT_JSON` inside it
   - `E2E_EVIDENCE_COMMIT`, `E2E_EVIDENCE_ENVIRONMENT`
6. Run `run.sh evidence $RUNNER_TEMP/le-upload $RUNNER_TEMP/le-evidence`, and upload only `le-upload`.
7. Always, unconditionally: `run.sh cleanup $RUNNER_TEMP/le-private`.

The fixture must be composed with the T-09 harness tree by the T-09 owner. It does not need `stage-app.sh`.

## Egress paths in the database (unchanged; traced at 5d81976)

None of these reaches `net.*`, pg_net, vault or `pg_notify`. Self-test G6 confirms that personas plus the fixture enqueue
nothing.

| Path | Who | Triggers or functions reached | Rows written | Egress |
|---|---|---|---|---|
| persona creation, `auth.users` insert | GoTrue admin API (setup) | `on_auth_user_created` → `handle_new_user` | `profiles`, `user_roles`, `notifications` | none. No trigger on `notifications`, `profiles` (except the roles-immutability check) or `user_roles` |
| `fixture.sql` | postgres (setup) | `enforce_profiles_roles_immutable` (BEFORE, no writes) | courses, modules, content_items, quizzes, quiz_questions, profiles, user_roles | none |
| lesson save and publish, `content_items` PATCH | app and contract | `update_content_items_updated_at` → `update_updated_at_column` | that row | none |
| builder open, `useCoursePermissions` | app | `has_admin_access`, `is_course_instructor` (read), `log_security_event` | `security_events`, possibly `submission_audit_events` | none. No trigger on either table |
| `run.sh owner` | postgres (setup) | none | one `courses` row | none |
| quiz editor mount | app | `get_quiz_questions_for_authoring` (read) | none | none |

## Open limits (explicit, not claimed)

- Same-lesson serialization under real concurrent in-flight writes, including a cancel-on-switch or concurrent-writer
  negative.
- The durable ambiguous Undo-to-base case (a send that may commit after document loss). It needs a deterministic
  interrupted schedule, which is not built here.
- Storage-disabled browsers. Without storage the UI says recovery is impossible (`recoverable: false`); this is not
  exercised.
- Sign-out A → B → A in the browser.
- Delayed-response schedules.
- Existing student quiz history preservation. The fixture has no history canary, and the T-09 and gradebook lanes own that
  scope.
- Curriculum rename and publish side actions.
- Firefox. The Back button is checked only after Preview. A microtask window remains between the identity check and the
  request.
- sessionStorage is not a confidentiality boundary, and no tenant-confidentiality claim is made. RLS is the authority.
- No deployed-backend verification, no migrations, no shared fixture or globalSetup changes.
