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

1. **Guard script** `scripts/e2e/assert-safe-target.mjs` is an allow-list with **no opt-in of any kind**. In `--mutating` mode every target variable (`VITE_SUPABASE_URL`, `SUPABASE_DB_URL`, `E2E_RELAY_TARGET`) must be set and be either loopback (`localhost`, `127.0.0.1`, `::1`) or a Supabase host whose project ref equals the repository variable `E2E_ISOLATED_TARGET_REF`, which itself must differ from the production ref. Refused: the production ref anywhere in any value, look-alike hosts, pooler hosts whose user is not the isolated ref, other IP literals, percent-encoded or unparseable values, `VITE_SUPABASE_PROJECT_ID` equal to production, and every value of the former `E2E_ALLOW_PRODUCTION_TARGET`, which is no longer read. The `workflow_dispatch` input that could type the production ref has been removed. Unit tests: `src/test/__tests__/assertSafeTarget.test.ts` (10 cases).
2. **Direct entrypoints are guarded, not just their usual caller.** `scripts/e2e/seed.sh` is the only supported way to apply `e2e/fixtures/seed.sql`: it runs the guard before `psql` and strips `PGHOST`, `PGHOSTADDR`, `PGSERVICE`, `PGSERVICEFILE`, `PGPORT`, `PGPASSFILE` so the URL it checked is the URL libpq uses. `e2e.yml` now calls the wrapper. `e2e/global-setup.ts` and `e2e/global-teardown.ts` run the guard before any sign-in, password bootstrap or delete.
3. **Local tooling parses the DSN strictly** (`scripts/local-db/assert-local-dsn.mjs`, 4 test groups covering 18 refusal forms): one loopback endpoint only; multihost lists, `hostaddr`, `host=`/`port=` query overrides, `service=`, `options=`, `passfile=`, percent-encoding, loopback-as-user tricks and libpq environment overrides are refused before `psql` starts. All three `scripts/local-db` entrypoints call it and run `psql` with the environment overrides removed.
4. **Negative harnesses demonstrate no database call.** `scripts/local-db/tests/guard-negative.sh` puts a fake `psql` on `PATH` that records any invocation and drives the four entrypoints with 40 remote or deceptive targets, including every former opt-in string: 40/40 refused, `psql` never invoked; a positive control confirms a loopback DSN does reach `psql`, so the negatives are meaningful. Exit 126/127 (entrypoint not found) counts as a harness failure, not a refusal.
5. **Schema replay verifies identities, not counts alone.** `build-from-snapshot.sh` compares every function, policy, trigger, RLS flag, table grant and function grant against `identities.tsv` (md5 of the live definition, produced by `scripts/local-db/identities.sql`), after the count manifest. `scripts/local-db/tests/build-negative.sh` proves: correct snapshot passes and prints the live-broken view omission explicitly (`quiz_analytics` and its three grants); a same-count snapshot with one altered function body is rejected (`IDENTITY MISMATCH … start_quiz_attempt`); an injected DDL failure is rejected; a tampered manifest count is rejected; a snapshot without `identities.tsv` is rejected.

## Local full Supabase stack for real Playwright QA: investigated, blocked here

The repository already describes its local stack: `supabase/config.toml` (API 54321, DB 54322, auth, storage, studio 54323) is what `supabase start` runs, and the guard accepts `localhost:54321` as a target. It cannot run in this session's container: the Docker binary is present but no daemon socket exists, the Supabase CLI is absent and requires Docker, and GitHub release downloads for PostgREST, GoTrue, Storage and Deno return HTTP 403 through the egress proxy (npm registry is reachable, but these components are not npm packages; no apt candidate exists). No paid service and no new account is needed to unblock this: `supabase start` on any Docker-capable machine (the owner's, or a CI runner with Docker) gives an isolated stack the guard already accepts, and `scripts/e2e/seed.sh` then seeds it. Until that exists, browser-tier acceptance remains BLOCKED and is reported as such; SQL-level proof is on the local PostgreSQL snapshot only.

## Publication-safety report (local run, head of `claude/inspiring-shannon-wkmu6y`)

| Check | Result | Tier |
|---|---|---|
| Branch push fires a workflow | No (verified on the first push: zero runs) | ci |
| PR event reaches the seed step | No: run 41207463923 stopped at the guard step; seed, fixture check and suite skipped | ci |
| Any event, input or environment value grants production for a mutating run | No; the opt-in path is removed from guard, workflow and tests | code, local |
| Guard refuses unset, production, look-alike and encoded targets | 10/10 unit tests | local |
| DSN parser refuses multihost, hostaddr, query/keyword overrides, service, options, env overrides | 4/4 test groups (18 refusal forms) | local |
| Entrypoints refuse before any `psql` process | 40/40, fake-psql marker never written; positive control reaches psql | local |
| Seed script rehearsal | `e2e/fixtures/seed.sql` exit 0 on the local snapshot after `local-preseed.sql` | local-db |
| Teardown with default env | logs "DB teardown disabled", no network writes; now also guarded when enabled | local |
| Schema replay completeness | counts and 1,124 object identities match the live catalog; 3 grants on the live-broken `quiz_analytics` omitted explicitly; wrong-identity, injected-DDL, tampered-manifest and missing-identities snapshots rejected | local-db |
| RLS matrix (3 tables × 9 actors, 54 checks) | 51/54 on live-equivalent policies; 54/54 with migration `20261101000000` applied locally | local-db |
| Assessed-progression guard (16 checks) | started-only quiz accepted and certificate issued (policy gap T-09); `graded` not counted by the certificate trigger (T-10) | local-db |
| `start_quiz_attempt` authorization (10 checks) | 6/10 live-equivalent; 10/10 with migration `20261101000100` applied locally | local-db |
| `public.quiz_analytics` | broken live (42P17); no consumer in `src/` | live-catalog |
| Browser-tier acceptance (WP-01, A6, A7, A8) | **BLOCKED**: no isolated API stack reachable from this container | n/a |

Nothing here wrote to the live project. Both migrations remain unapplied. Policy questions are in `completion-policy-trace.md`.

## Residual blockers

- **Isolated Supabase stack for browser QA**: needs a Docker-capable machine running `supabase start`, or an isolated project declared via the repository variable `E2E_ISOLATED_TARGET_REF` and matching secrets (owner action; no new grants were created from this session).
- **Workflow consequence**: with the opt-in removed, `e2e.yml` fails closed on every push, pull request and dispatch until an isolated target is declared. This is the handoff's requirement (Start Here line 29; master plan lines 36, 108, 149, 490, 513), stated here so it is not mistaken for a regression.
- **Owner decisions** (unchanged): apply `20261101000000` and `20261101000100` through `db-migrate.yml`; completion policy for started-only quizzes and the `graded` vocabulary; historical reconciliation; branch and PR naming.
