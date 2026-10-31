# Publication gate — what a push, a pull request and a merge trigger

Read-only inventory of `.github/workflows/*.yml` at `main` = `99f81e3ee5bf42c84fc8926c3e934b26d737a27b`
(2026-10-31). Secrets are referenced by name only. This page exists because a draft PR is not a
safety control: the `pull_request` event runs the same seeding job as a push to `main`.

## Trigger inventory (source: workflow `on:` blocks)

| Workflow | `push` | `pull_request` | Other | Writes to the live project? |
|---|---|---|---|---|
| `test.yml` (lint, vitest, build) | `main`, `develop` | `main`, `develop` | none | No. Unit tests mock Supabase. |
| `pr-checks.yml` | none | `opened, synchronize, reopened` (any base) | none | No. Lint, migration-version check, model check, Deno function tests, vitest, build. |
| `security.yml` | `main`, `develop` | `main`, `develop` | weekly schedule | No. Secret scan, CodeQL. |
| `e2e.yml` | `main`, `develop` | `main`, `develop` | `workflow_dispatch` | **Yes.** `Seed E2E fixtures` runs `psql "$SUPABASE_DB_URL" … -f e2e/fixtures/seed.sql` (lines 231-306), then `global-setup.ts` mints sessions and may reset E2E passwords through the `admin-users` function, and journey specs insert/delete rows for the three `e2e-*` accounts. `concurrency.group: e2e-shared-supabase` confirms a single shared live database. |
| `nightly.yml` | none | none | daily `0 2 * * *`, dispatch | No. Vitest with coverage, `npm outdated`. |
| `db-migrate.yml` | none | none | `workflow_dispatch` only, `confirm: apply` | **Yes, by design.** Applies one named migration file via `psql` and records the ledger row. Never fires automatically. |

No workflow deploys Edge Functions or the frontend (`grep -n "functions deploy\|supabase db push\|deploy"` over `.github/workflows` finds only comments in `db-migrate.yml`). Frontend and function deployment therefore happen outside GitHub Actions. Lovable's GitHub integration syncs `main` in both directions (every commit today carries `X-Lovable-Edit-ID`); whether a push to `main` auto-publishes the Lovable-hosted site could **not** be verified from the repository and is treated as **possible** (handoff §9, last row).

## Which workflow revision runs for a pull request

For the `pull_request` event GitHub checks out and executes the workflow files from the **merge commit** of the PR head into the base (`refs/pull/<n>/merge`). A change to `e2e.yml` on the PR branch is therefore the version that runs on that PR. None of the workflows use `pull_request_target`, which would run the base branch's definition instead. Consequence: the fail-closed guard added on this branch takes effect on the first PR that carries it, and it cannot be bypassed by the PR's own content without that bypass being visible in the diff.

## What happens today, concretely

| Action | Workflows fired | Production effect |
|---|---|---|
| Push a commit to `claude/…`, `fix/…`, `feat/…` (no PR) | none | none |
| Open or update a PR against `main` or `develop` | `test.yml`, `pr-checks.yml`, `security.yml`, `e2e.yml` | `e2e.yml` seeds and exercises the live project with the shared E2E accounts |
| Push to `main` (merge, or Lovable commit) | `test.yml`, `security.yml`, `e2e.yml` | same as above |
| Dispatch `db-migrate.yml` with `confirm: apply` | that workflow | applies the named migration to the live database |

## Production-safe PR workflow (on this branch)

1. **One strict libpq parser, used everywhere a DSN is accepted.** `scripts/local-db/assert-local-dsn.mjs` parses the *effective* libpq endpoint. The keyword form is a deliberately narrow grammar (plain `key=value` tokens from an allow-list with a safe value charset; quotes, backslashes, `=` or `,` inside values, spaces around `=` and repeated keys are refused), because libpq honours backslash escapes even in unquoted values (`password=x\ host=localhost` is one value and the real host stays elsewhere, verified with `PQconninfoParse`). URI form: exactly one host; `hostaddr`, multihost lists, `host=`/`port=` query or keyword overrides, `service=`, `options=`, `passfile=`, duplicate or malformed parameters, `'#'` anywhere (libpq treats it as data, so `db#?host=remote` redirects while a web parser sees a fragment), more than one `'@'` (libpq splits at the first), percent-encoding outside the password, and libpq environment overrides (`PGHOST`, `PGHOSTADDR`, `PGSERVICE`, `PGSERVICEFILE`, `PGPORT`) are refused before any `psql`. Loopback is matched exactly and case-sensitively (`localhost`, `127.0.0.1`, `::1`, or a `/tmp` socket directory); a declared isolated project is accepted only as `db.<ref>.supabase.co` or a Supavisor pooler host whose user is `postgres.<ref>`, with `<ref>` equal to `E2E_ISOLATED_TARGET_REF` and different from production. The semantics were checked against libpq itself: `scripts/local-db/tests/dsn-differential.py` loads `libpq.so.5` via ctypes and calls `PQconninfoParse` (no connection) over a 36-DSN corpus; every DSN the guard accepts resolves in libpq to the same single loopback host with no `hostaddr` or `service`, and every DSN libpq would send elsewhere is refused.
2. **The E2E guard** (`scripts/e2e/assert-safe-target.mjs`) evaluates `SUPABASE_DB_URL` with that parser (previously it looked only at the URL host, which let `?hostaddr=`, `?host=`, `?service=` and `#?host=` through: the three review findings). API targets (`VITE_SUPABASE_URL`, `E2E_RELAY_TARGET`) must be plain `http(s)` URLs with no userinfo, query or fragment, and loopback or the declared isolated project. There is **no opt-in of any kind**; the former variable is ignored and the dispatch input is gone.
3. **Every database-touching entrypoint is guarded before its first `psql`:** `scripts/e2e/seed.sh` (the only seed path; the workflow calls it), `e2e/global-setup.ts`, `e2e/global-teardown.ts`, all three `scripts/local-db` tools, and the negative-test harness `build-negative.sh` itself (it creates and drops databases, so it now validates `PGBASE` first and strips the libpq environment for setup and cleanup). `psql` always runs with the override variables removed.
4. **Negative and positive controls on the actual entrypoints** (`scripts/local-db/tests/guard-negative.sh`, fake `psql` on `PATH` recording any invocation): 69 refusal cases across the four tools, the seed wrapper and the harness, including the reviewer's `?hostaddr=`, `?host=`, `?service=`, `#?host=`, `#?hostaddr=`, `%3F`, `a@b@`, multihost, loopback-as-user, `PGHOSTADDR`/`PGHOST` overrides and every former opt-in string: all refused, `psql` never started. **7 positive controls** prove valid targets do reach the fake `psql`: each local tool with a loopback DSN, the harness with a loopback `PGBASE`, the seed wrapper with loopback targets, and the seed wrapper with a declared isolated project by pooler DSN and by db-host DSN. An earlier version of this report claimed a positive control that was only an ad-hoc run; it is now part of the script and counted in its output.
5. **Schema replay verifies identities, not counts alone** (`build-from-snapshot.sh` + `identities.tsv`), with `build-negative.sh` proving rejection of a same-count wrong-definition snapshot, an injected DDL failure, a tampered manifest and a missing identities file, and explicit reporting of the live-broken `quiz_analytics` omission.

## Local full Supabase stack for real Playwright QA: investigated, blocked here

The repository already describes its local stack: `supabase/config.toml` (API 54321, DB 54322, auth, storage, studio 54323) is what `supabase start` runs, and the guard accepts `localhost:54321` as a target. It cannot run in this session's container: the Docker binary is present but no daemon socket exists, the Supabase CLI is absent and requires Docker, and GitHub release downloads for PostgREST, GoTrue, Storage and Deno return HTTP 403 through the egress proxy (npm registry is reachable, but these components are not npm packages; no apt candidate exists). No paid service and no new account is needed to unblock this: `supabase start` on any Docker-capable machine (the owner's, or a CI runner with Docker) gives an isolated stack the guard already accepts, and `scripts/e2e/seed.sh` then seeds it. Until that exists, browser-tier acceptance remains BLOCKED and is reported as such; SQL-level proof is on the local PostgreSQL snapshot only.

## Publication-safety report (local run, head of `claude/inspiring-shannon-wkmu6y`)

| Check | Result | Tier |
|---|---|---|
| Branch push fires a workflow | No (verified on the first push: zero runs) | ci |
| PR event reaches the seed step | No: run 41207463923 stopped at the guard step; seed, fixture check and suite skipped | ci |
| Any event, input or environment value grants production for a mutating run | No; the opt-in path is removed from guard, workflow and tests | code, local |
| Guard refuses unset, production, look-alike and encoded targets; `SUPABASE_DB_URL` evaluated as libpq DSN | 12/12 unit tests | local |
| DSN parser refuses multihost, hostaddr, query/keyword overrides, service, options, `#`, multi-`@`, percent tricks, keyword quotes/backslash escapes, env overrides | 5/5 test groups (41 refusal forms); libpq differential 45 DSNs, 0 disagreements | local |
| Entrypoints (tools, seed wrapper, harness) refuse before any `psql` process | 93/93 refused, marker never written; 9/9 positive controls (incl. keyword-form loopback) reach the fake psql | local |
| Seed script rehearsal | `e2e/fixtures/seed.sql` exit 0 on the local snapshot after `local-preseed.sql` | local-db |
| Teardown with default env | logs "DB teardown disabled", no network writes; now also guarded when enabled | local |
| Schema replay completeness | counts and 1,124 object identities match the live catalog; 3 grants on the live-broken `quiz_analytics` omitted explicitly; wrong-identity, injected-DDL, tampered-manifest and missing-identities snapshots rejected | local-db |
| RLS matrix (3 tables × 9 actors, 54 checks) | 51/54 on live-equivalent policies; 54/54 with migration `20261101000000` applied locally | local-db |
| Assessed-progression guard (16 checks) | started-only quiz accepted and certificate issued (policy gap T-09); `graded` not counted by the certificate trigger (T-10) | local-db |
| `start_quiz_attempt` authorization (10 checks) | 6/10 live-equivalent; 10/10 with migration `20261101000100` applied locally | local-db |
| `public.quiz_analytics` | broken live (42P17); no consumer in `src/` | live-catalog |
| Browser-tier acceptance (WP-01, A6, A7, A8) | **BLOCKED**: no isolated API stack reachable from this container | n/a |
| Secret scan of the PR range (`security.yml`, TruffleHog) | **Red, caused by this branch**: 4 unverified results on fabricated `user:placeholder@host` test DSNs (tracker T-35); fix assembled from parts committed locally, not pushed; the range scan cannot turn green without a fresh branch or owner acceptance | ci |

Nothing here wrote to the live project. Both migrations remain unapplied. Policy questions are in `completion-policy-trace.md`.

## Residual blockers

- **Isolated Supabase stack for browser QA**: needs a Docker-capable machine running `supabase start`, or an isolated project declared via the repository variable `E2E_ISOLATED_TARGET_REF` and matching secrets (owner action; no new grants were created from this session).
- **Workflow consequence**: with the opt-in removed, `e2e.yml` fails closed on every push, pull request and dispatch until an isolated target is declared. This is the handoff's requirement (Start Here line 29; master plan lines 36, 108, 149, 490, 513), stated here so it is not mistaken for a regression.
- **Owner decisions** (unchanged): apply `20261101000000` and `20261101000100` through `db-migrate.yml`; completion policy for started-only quizzes and the `graded` vocabulary; historical reconciliation; branch and PR naming.
