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

1. **Guard script** `scripts/e2e/assert-safe-target.mjs` is an allow-list, not a deny-list. In `--mutating` mode every target variable (`VITE_SUPABASE_URL`, `SUPABASE_DB_URL`, `E2E_RELAY_TARGET`) must be set and must be either loopback (`localhost`, `127.0.0.1`, `::1`) or a Supabase host whose project ref equals `E2E_ISOLATED_TARGET_REF`, which itself must differ from the production ref. Everything else is refused: the production ref anywhere in any value, look-alike hosts (`<prod>.supabase.co.attacker.tld`, `localhost.attacker.tld`), pooler hosts whose user is not the isolated ref, other IP literals, percent-encoded or unparseable values, and `VITE_SUPABASE_PROJECT_ID` equal to production. Unit tests: `src/test/__tests__/assertSafeTarget.test.ts` (10 cases, including deceptive URLs).
2. **No automatic production opt-in.** The workflow no longer grants `E2E_ALLOW_PRODUCTION_TARGET` for any event. The only way to run the mutating suite against the live project is the `allow_production_target` `workflow_dispatch` input, typed by a person as the exact production ref. Pushes and pull requests always stop at the guard step until a repository variable `E2E_ISOLATED_TARGET_REF` names an isolated project and the target secrets point at it.
3. **`e2e/global-setup.ts`** runs the same guard before any sign-in or password bootstrap.
4. **Local isolated database** (`scripts/local-db/`): `build-from-snapshot.sh` now fails on any non-idempotency DDL error and on any mismatch against `manifest.env` (tables, views, functions, policies, triggers, RLS tables, enums recorded from the live catalog). Verified: correct snapshot builds and matches (tables 120, views 6 of 7 with `quiz_analytics` declared broken live, functions 118, policies 341, triggers 51); a tampered manifest and a partial snapshot are both rejected.

## Publication-safety report (local run, 2026-10-31, head of `claude/inspiring-shannon-wkmu6y`)

| Check | Result | Tier |
|---|---|---|
| Branch push fires a workflow | No (verified on the first push: zero runs) | ci |
| PR event reaches the seed step | No: run 41207463923 stopped at the guard step; seed, fixture check and suite skipped | ci |
| Guard refuses unset, production, look-alike and encoded targets | 10/10 unit tests pass | local |
| Guard accepts loopback and a declared isolated project only | covered by the same tests | local |
| Any event grants production opt-in automatically | No; only the typed dispatch input | code |
| Seed script rehearsal | `e2e/fixtures/seed.sql` exit 0 on the local snapshot after `local-preseed.sql` | local-db |
| Teardown with default env | logs "DB teardown disabled", no network writes | local |
| Schema replay completeness | fail-closed with manifest; one live-broken view declared explicitly | local-db |
| RLS matrix (3 tables × 9 actors, 54 checks) | 51/54 on live-equivalent policies: the enrolled-instructor actor reads another learner's progressions, quiz submissions and quiz answers; 54/54 with migration `20261101000000` applied locally | local-db |
| Assessed-progression guard (16 checks) | assignment without or with draft submission refused; submitted accepted; quiz without submission refused; **started-only quiz accepted** and certificate issued (policy gap T-09); `graded` not counted by the certificate trigger (T-10) | local-db |
| `start_quiz_attempt` authorization (10 checks) | 6/10 on live-equivalent: unenrolled learner starts attempts on published and unpublished quizzes, another course's instructor too; 10/10 with migration `20261101000100` applied locally | local-db |
| `public.quiz_analytics` | broken in the live catalog: `SELECT` raises 42P17 infinite recursion; no consumer in `src/` | live-catalog |

Nothing in this report was produced by writing to the live project. Both migrations remain unapplied.

Open points for the owner:

- Provide an isolated Supabase project and set the repository variable `E2E_ISOLATED_TARGET_REF` plus matching secrets, **or** accept that the Playwright job stays red on every push and pull request. A production dispatch is possible but requires typing the ref.
- Approve `db-migrate.yml` dispatches for `20261101000000` (RLS scope) and `20261101000100` (quiz-start authorization) after review.
- Decide the completion policy for started-only quizzes (T-09) and the `graded` vocabulary (T-10).
- Confirm the branch and PR naming (this session is bound to `claude/inspiring-shannon-wkmu6y`).
