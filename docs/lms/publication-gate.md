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

## Production-safe PR workflow (prepared on this branch, pending owner confirmation)

1. **Guard script** `scripts/e2e/assert-safe-target.mjs` resolves the project ref from `VITE_SUPABASE_URL`, `SUPABASE_DB_URL`, `E2E_RELAY_TARGET` and `VITE_SUPABASE_PROJECT_ID`. An **unset** variable counts as production, because every code default is the production URL. In `--mutating` mode it exits 3 unless `E2E_ALLOW_PRODUCTION_TARGET` equals the production ref exactly. Verified locally: unset → refused; explicit production URL → refused; loopback targets → accepted; explicit opt-in → accepted; `--read-only` → never blocks.
2. **Seed step** in `e2e.yml` now runs the guard first. The opt-in is set only when `github.event_name != 'pull_request'`, so a PR run stops at the guard, red, with the reason printed. Pushes to `main` and manual dispatches keep today's behaviour until the owner decides otherwise.
3. **`e2e/global-setup.ts`** runs the same guard before any sign-in or password bootstrap, so a local `npm run e2e` or `e2e:relay` with default variables refuses rather than mutating production.
4. **Local isolated database** (`scripts/local-db/`): a disposable PostgreSQL 16 built from a read-only catalog snapshot plus a Supabase shim. Policies, triggers and the seed script run there; `scripts/local-db/tests/*.sql` are role-scoped RLS tests. Runners refuse non-loopback connection strings.

Open points for the owner before any PR is opened:

- Accept that PR runs of `e2e.yml` fail closed (red) until an isolated target exists, **or** approve a policy that the Playwright job does not run on `pull_request` and instead runs the local-database policy tests plus the existing unit suite. The second option is a workflow change, not a skipped failing test, but it is the owner's call.
- Decide whether `main` pushes may keep seeding the live project (status quo, inherited from the repository's own CI design).
- Confirm the branch and PR naming: this session is bound to `claude/inspiring-shannon-wkmu6y`; the handoff asks for `fix/lms-*` style branches. Creating additional branches needs explicit permission under this session's rules.
