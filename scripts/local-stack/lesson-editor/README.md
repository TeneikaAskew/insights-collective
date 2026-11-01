# Lesson-editor acceptance fixture: source and plan for isolation review

**Status:** source only, on local branch `local/lesson-editor-fixture` (based on the published composition 0e98de7, #142).
Nothing here has run against a real `supabase start` stack. Nothing has been dispatched, and the shared workflow has not
been edited. Integrating this into the shared runner (`e2e.yml` and the checker) belongs to the T-09 owner. The snippet
below is a proposal only.

**Purpose:** acceptance (WP-04/WP-08) of the lesson save and reload behaviour in #142. It covers what the mocked tests
cannot cover:

- real TipTap
- the real version trigger and the conditional fence
- roles enforced by real RLS
- the recovery screens at 1440x900, 768x1024 and 390x844

## Evidence tiers

| Tier | What | Status |
|---|---|---|
| Source and mocked | #142's Vitest suites | passed (1872 tests, PR Checks run 41324232146) |
| LOCAL-SIM | `tests/guards-selftest.sh`: PG16 with the managed layout simulated, the T-09 bootstrap, and RLS as role `authenticated` with JWT claims | 21/21 here, with causal controls (below) |
| LOCAL isolated stack | `backend-contract.mjs` (PostgREST + GoTrue with real persona JWTs) and `lesson-editor.spec.ts` (built app, Chromium) | **not run** (needs the shared runner) |
| Deployed backend | none | **out of scope**. The deployed trigger stays unverified, and nothing here claims otherwise |

## Files

- **`personas.mjs`**: creates OWNER (instructor, owns the course), OTHER (instructor) and STUDENT.
  - Accounts are made through the local GoTrue admin API, using T-09's `api-http.mjs`: strict loopback origin, no
    redirects, keys only from 0600 files.
  - It writes `personas.json` and one Playwright `state-<P>.json` per persona, bound to the app origin with the app's key
    `supabase.auth.token`. All files are 0600, inside a fresh 0700 directory.
- **`fixture.sql`**: setup only, applied once per fresh stack, with no reset and no teardown.
  - **Refuses** to run:
    - without the run.sh acknowledgement
    - when any account other than `le-*`/`t09-*@local.test` or the three snapshot fixture accounts exists
    - when a persona id is not an `le-*` account
    - when course C1 already exists
  - **Seeds** course C1 (owner OWNER) and one module containing:
    - pages A and B
    - page N with a NULL `updated_at`, set by INSERT (the trigger is BEFORE UPDATE only, so nothing is bypassed)
    - quiz Q with a `quizzes` row and 2 questions
    - pages K and KN, used only by the contract checks
  - Writes no DDL, no settings, no deletes, and no enrollment, submission or grade rows.
- **`backend-contract.mjs`**: LOCAL PostgREST checks using exactly the request shape the app sends. Each finding is
  written to `backend-contract.json` and labelled LOCAL.
  - C1: a write on the returned version changes 1 row. The trigger replaces the client `updated_at` and advances the
    version, and the returned row equals the stored row.
  - C2: a stale version changes 0 rows.
  - C3: the returned version string works as the next condition.
  - C4: an IS NULL write changes 1 row, and a second one changes 0 (the fence).
  - C5: OTHER and STUDENT change 0 rows even with the exact current version.
  - C6: the quiz type stays `quiz`.
- **`run.sh`**:
  - `setup` runs personas, then the fixture, then the contract.
  - `owner OWNER|OTHER` moves only C1 (the RLS-ZERO-ROW case).
  - `read` and `quizhash` are read-only and accept fixture ids only.
  - Every call re-checks the DSN with `assert-local-dsn.mjs`.
  - It never starts, stops or resets a stack, and it is not a globalSetup.
- **`tests/guards-selftest.sh`**: the LOCAL-SIM self-test. `LE_ST_CONTROL=no-trigger|no-rls` are the causal controls.
- **`e2e/lesson-editor/playwright.lesson-editor.config.ts`**: scratch config with no globalSetup, no teardown, no
  webServer, Chromium only, 1 worker and 0 retries.
- **`e2e/lesson-editor/lesson-editor.spec.ts`**: 17 tests with no `route()` stubs. Each case is labelled AUTHENTIC,
  BROWSER-OFFLINE, RLS-ZERO-ROW, SECOND-TAB or RELOAD.
  - E1: save. The returned row equals the DB row, the trigger advanced the version, and the save survives a reload.
  - E2: switching lessons and Preview inside 800 ms, then Back and reload. Writes for a lesson never overlap.
  - E3: offline gives "Save not confirmed" and the leave warning. Retry fences, then persists.
  - E4: reload after an unconfirmed send. The durable record is present while the send is unconfirmed. The fresh page restores, reconciles,
    saves and clears the record.
  - E5: the NULL-version lesson saves through IS NULL.
  - E6: a second tab causes a conflict. Keep my version wins.
  - E7: real RLS zero rows. No false success; retry works after access returns.
  - E8: quiz type fixed. A rename keeps the quiz and question hash.
  - E9: deep link and missing lesson.
  - R-OTHER and R-STUDENT: Not authorized, and zero writes.
  - Screens at each of 3 viewports: deep link, saved, not confirmed, leave warning, restored after reload, conflict,
    fixed type, and Not authorized for OTHER. Each capture is a PNG plus JSON with method, path and status only, a
    sha256 of title and content, and a foreign-origin assertion.
  - It refuses before any browser or DB work when a label, an `LE_*` variable or a loopback origin is wrong. Both
    refusals were observed here.

## Results here (LOCAL-SIM only)

`guards-selftest.sh` ran on a scratch PG16 cluster with T-09's simulated managed layout and `bootstrap.sh`.

- **Normal run:** 21 passed. These cover G1 to G5 (guards), S1 to S8 (trigger, condition, fence and RLS under the
  snapshot policies) and R1 to R8 (runner guards, RLS-ZERO-ROW move and restore).
- **`no-trigger` control:** S2 fails, so the trigger check is causal.
- **`no-rls` control:** S6, S7, S8 and R6 fail, so the RLS checks are causal.

**Finding from the no-trigger control.** The IS NULL fence (S5) still holds without the trigger, because the client
also writes `updated_at`. Detecting versioned conflicts without the trigger would depend on the client clock producing
distinct values. That is why C1/S2 must pass on any backend before we claim conflict safety there.

These results say nothing about PostgREST, GoTrue, PG15 parity or the deployed database.

## Proposed shared-runner integration (for the T-09 owner; NOT applied)

This would be one new `e2e.yml` dispatch option, `lesson-editor`. It reuses the qualified steps unchanged:

- Docker >= 28
- owned per-mode network with loopback host binding
- ports guard
- `workdir.sh`, `supabase start --network-id`
- `bootstrap.sh`
- cleanup

Then:

1. Write the anon and service keys from `supabase status` to 0600 files.
2. Build the app with `VITE_SUPABASE_URL=http://127.0.0.1:54321` and the local anon key. Serve it with
   `vite preview --host 127.0.0.1 --port 8080`, as the readonly-courses job does.
3. Run `scripts/local-stack/lesson-editor/run.sh setup http://127.0.0.1:54321 http://127.0.0.1:8080 <loopback db url>
   <anon file> <service file> $RUNNER_TEMP/le-work`.
4. Run `npx playwright test -c e2e/lesson-editor/playwright.lesson-editor.config.ts` with:
   - `LE_APP_ORIGIN`, `LE_API_ORIGIN`, `LE_DB_URL`, `LE_WORK_DIR`
   - `E2E_EVIDENCE_COMMIT=${{ github.sha }}`, `E2E_EVIDENCE_ENVIRONMENT`
5. Upload the report, the screenshots and JSON, and `backend-contract.json`. Never upload `personas.json` or the
   `state-*` files.

**Runtime ordering:** this branch's tree does not contain `scripts/local-stack/t09`. It must be composed with the T-09
harness (#140) first, by the T-09 owner. It also depends on that harness's current blocker, the pg_cron APP verifier,
only if the job reuses `stage-app.sh`. The plan above does not need `stage-app.sh`.

## Harness pin and egress paths (for the T-09 owner's integration)

**Harness pin.** This fixture was tested against T-09 harness `5d81976`, where `scripts/local-stack/t09/api-http.mjs` has
blob `fb2b49d8d20f5a00da8e3bcbc55ad265cf6a1766`. `run.sh setup` refuses any other blob. If the harness changes that file,
the run stops until this lane re-checks it and updates the pin.

**PRE egress guard.** The integrated mode is expected to run T-09's unchanged `stage-pre.sh` guard and its sentinels
before bootstrap, and this fixture does not opt out of them. The write paths below were traced in the snapshot schema at
`5d81976`. None of them reaches `net.*`, pg_net, vault or `pg_notify`.

| Path | Who | Triggers or functions reached | Rows written | Egress |
|---|---|---|---|---|
| persona creation, `auth.users` insert | GoTrue admin API (setup) | `on_auth_user_created` → `handle_new_user` | `profiles`, `user_roles`, `notifications` | none. No trigger exists on `notifications`, `profiles` (except the roles-immutability check) or `user_roles` |
| `fixture.sql` | postgres (setup) | `enforce_profiles_roles_immutable` (BEFORE, no writes). The `content_items` trigger is BEFORE UPDATE only, so it does not fire on INSERT | courses, modules, content_items, quizzes, quiz_questions, profiles, user_roles | none |
| lesson save and publish, `content_items` PATCH | app and contract (OWNER, OTHER, STUDENT JWTs) | `update_content_items_updated_at` → `update_updated_at_column` (sets NOW() only) | that row | none |
| builder open, `useCoursePermissions` | app | RPCs `has_admin_access`, `is_course_instructor` (read-only) and `log_security_event` | `security_events` and possibly `submission_audit_events` | none. No trigger exists on either table |
| `run.sh owner` | postgres (setup) | none (no trigger on `courses`) | one `courses` row | none |
| quiz editor mount | app | RPC `get_quiz_questions_for_authoring` (read) | none | none |

**Not exercised.** The spec never clicks the AI actions (`assistant`/`generate-*` Edge Functions), so it makes no
`functions/v1` call. Any `functions/v1` request would be recorded, and a non-loopback one fails the screen captures'
foreign-origin assertion. If the guard reports a send during this mode, treat that as a finding against this table. Do
not loosen the guard.

## Known limits and residuals

- **sessionStorage is not a confidentiality boundary**, and no tenant-confidentiality claim is made. RLS is the
  authority for writes.
- **No storage, no durability.** Without storage, recovery after a reload is impossible, and the UI says so
  (`recoverable: false`). The spec does not exercise a storage-disabled browser.
- **Firefox:** not covered here (Chromium only).
- **Back button:** only checked after Preview. The leave guard covers in-app links, not every BrowserRouter history
  action.
- **Identity check:** a microtask window remains between the identity check and the request leaving the browser.
- **Telemetry side write:** opening the builder calls `log_security_event` (an existing app behaviour). Those rows are
  local telemetry, not fixture data.
- **Session expiry:** persona sessions expire on the GoTrue default. The storage states carry refresh tokens, and
  supabase-js refreshes them.
- **Not attempted:** deployed-backend verification, migrations, and changes to shared fixtures or the shared
  globalSetup/teardown.
