# Isolated full-stack QA job on GitHub Actions: implementation-ready plan (not dispatched)

Status: plan only. Nothing here has been run in Actions. No hosted project, no repository secret, no
production connection is required or used. The stack does **not** exist yet; this is the smallest
dependency-ordered scope to make it exist and prove it before any LMS acceptance claim is made.

## Why `supabase start` alone is not sufficient

- The base tables (`courses`, `profiles`, `blog_posts`, …) predate the first migration file; replaying
  `supabase/migrations/` from zero applies 28 of 233 files (`scripts/local-db/README.md`). A fresh
  `supabase start` + `db reset` therefore does not produce the live schema.
- The live project is PostgreSQL 15 (`15.8.1.054`); `supabase/config.toml` sets `major_version = 15`.
  The snapshot proof in this repository ran on PostgreSQL 16 (Ubuntu 24.04 has no `postgresql-15`
  package). Identity parity on PG15 is therefore **unproven** and is an explicit gate below.
- `scripts/local-db/build-from-snapshot.sh` deliberately **refuses** a database that has the managed
  Supabase roles (`supabase_auth_admin`, `supabase_storage_admin`, `authenticator`) and installs shims
  for `auth`, `storage`, `vault`, `cron`, `net`. That guard stays as is. The authentic stack needs a
  **separate** bootstrap that applies the same schema-only snapshot onto real managed services.

## Target architecture (all loopback on the runner)

| Component | Source | Notes |
|---|---|---|
| PostgreSQL 15, GoTrue, PostgREST, Storage, Studio, Edge runtime | `supabase start` via the Supabase CLI (npm `supabase@2.x`, Docker on `ubuntu-latest`) | Uses the repository's `supabase/config.toml` unchanged: `project_id` stays the production ref so `assert-safe-target.mjs` keeps its deny identity. The CLI uses `project_id` only to name containers. |
| Schema | committed, sanitized snapshot: `scripts/local-stack/schema/{01..05}.sql`, `identities.tsv`, `manifest.env` | Schema-only, no rows, scanned for secret-shaped strings (today's scan: none). Produced by the read-only catalog queries already in `scripts/local-db/identities.sql`. |
| Fixtures | `scripts/local-db/local-preseed.sql` (synthetic accounts, reference course and modules) then `e2e/fixtures/seed.sql` through `scripts/e2e/seed.sh` | The guard accepts `127.0.0.1:54322`. Passwords are synthetic literals set in the workflow, not secrets. |
| Edge Functions | `supabase functions serve` from `supabase/functions/` | Local only. Functions that reach external hosts (`coursera-refresh`, `scrape-*`, `twitter-scraper`, `execute-code`) are not exercised by the acceptance specs; their `vault` secrets are set to local placeholders so a stray call fails fast. |
| Keys | the CLI's local demo anon/service keys from `supabase status -o env` | Public, fixed, non-production. |
| Browser | Playwright (already a dev dependency), Chromium | No relay needed: the runner reaches loopback directly. |

## Dependency-ordered local draft-PR scope

Each item is one small PR, built and verified locally before the workflow is ever dispatched.

### PR-A `tooling(local-stack): authentic bootstrap` (prerequisite for everything else)

1. Sanitized schema-only snapshot under `scripts/local-stack/schema/` with `manifest.env`, two identity
   manifests and `ORIGIN.md`/`DIVERGENCES.md`. Scanned across all five DDL files including column
   defaults, constraints, indexes and views: one production identity (a fixed user-id default on
   `resources.created_by`) was found and removed, recorded as a local-only divergence; no other UUIDs,
   secrets, e-mails or data rows. The unsanitized form exists only in unpushed local history.
2. **Startup ordering.** The CLI applies `supabase/migrations` and `seed.sql` on `supabase start`, and
   the historical chain replays only 28 of 233 files. `scripts/local-stack/workdir.sh` prepares a
   disposable workdir with the repository's `config.toml` copied **unchanged** (`project_id` stays the
   production ref, so the guard's deny identity is intact), an **empty** migrations directory, the seed
   disabled, and functions linked. `supabase start --workdir <dir>` runs there, local only; no `--linked`
   and no remote command. The bootstrap runs after start, before the E2E seed.
3. `scripts/local-stack/bootstrap.sh <loopback DSN>`: DSN validated by the single libpq parser;
   authenticity checked by **object identity and ownership**, not schema ownership: the seven managed
   roles exist, `auth.users`/`auth.identities`/`auth.schema_migrations` and `auth.uid()` are owned by
   `supabase_auth_admin`, `storage.buckets`/`storage.objects`/`storage.migrations` by
   `supabase_storage_admin` (the official init creates the schemas `AUTHORIZATION supabase_admin`; the
   services own their objects). These checks were derived from the documented layout and exercised only
   against a simulated layout; the first real `supabase start` run may show the check needs correcting,
   in which case the check is corrected, never relaxed to a role-name test. Every `psql` exit status
   is propagated: a FATAL or connection loss fails the run even when no `ERROR` line was printed.
4. `localize.sql`: unschedules cron, sets a loopback placeholder for each **distinct** vault secret
   name (create on first run, `vault.update_secret` afterwards; Vault names are unique), creates empty
   buckets. Idempotent.
5. `verify-identities.sh`: two comparisons, labelled separately. **Live-verified** (functions, policies,
   triggers, RLS flags, table and function grants; manifest read from the live catalog on 2026-10-31)
   and **snapshot-derived** (tables, columns with type/null/default, constraints, indexes, views, enums;
   manifest derived from applying the sanitized DDL, so it proves the DDL applies identically, and its
   comparison to the current live catalog is **UNVERIFIED**). Declared divergences (`DIVERGENCES.tsv`)
   are reported, anything else fails. Not covered by either: sequences, comments, ownership of public
   objects, storage parameters, objects outside `public`.
6. Omission semantics: `quiz_analytics` is absent locally; a local `SELECT` raises 42P01
   undefined_table. The live 42P17 recursion is **not** reproduced; the object is omitted and reported.
7. Tests (`tests/bootstrap-negative.sh`, PG16 with the managed layout simulated by
   `tests/simulate-managed-stack.sql`): mutual refusal of the two bootstraps; positive smoke; idempotent
   localization; fail-closed on fake-psql FATAL during constraints and on partial identity output; parity
   catches a drifted column default and a drifted index; omission yields 42P01.

Evidence gate for PR-A on a real stack (not yet run): bootstrap exits 0 on a `supabase start` database
(PG15), both identity comparisons pass with only the declared divergences, the seed applies with exit 0.

### PR-B `ci: isolated E2E workflow` (depends on PR-A)

New workflow `e2e-isolated.yml`, deliberately separate from `e2e.yml`:

- `on: pull_request` (any base) and `workflow_dispatch`. No `push`.
- `permissions: contents: read` only. No `secrets.*` references anywhere in the file. No baseline
  regeneration, no commit step, no `git push`.
- Steps: checkout, Node 20, `npm ci`, `npx supabase start` (Docker is preinstalled on
  `ubuntu-latest`), `supabase status -o env` into job env (`VITE_SUPABASE_URL=http://127.0.0.1:54321`,
  anon key, `SUPABASE_DB_URL` exactly as `supabase status -o env` prints it (the loopback DSN on port 54322),
  `E2E_RELAY_TARGET=http://127.0.0.1:54321`), `node scripts/e2e/assert-safe-target.mjs --mutating`
  (must pass on loopback), `scripts/local-stack/bootstrap.sh`, `verify-identities.sh`,
  `scripts/local-db/local-preseed.sql`, `scripts/e2e/seed.sh` with a synthetic `E2E_TEST_PASSWORD`,
  `supabase functions serve` in the background, `npm run build`, preview server, Playwright.
- Artifacts: Playwright HTML report, traces, the screenshot matrix, `identities` diff. Retention 14 days.
- A guard step asserts the job environment contains no variable whose value includes the production
  ref and no `SUPABASE_SERVICE_ROLE_KEY` other than the CLI's local demo key.

Evidence gate: the job is green on a PR with the existing suite's **read-only** specs first
(`e2e/courses/course-list.spec.ts`, `course-detail.spec.ts`), then with the journeys. The
`e2e/global-setup.ts` password bootstrap path must be confirmed to work against local GoTrue (the
`admin-users` function's `setE2EPassword` action) or replaced by seeding the four accounts directly.

Risks: `supabase start` image pulls can exceed 5 minutes; PG15 deparse differences in policy text may
produce identity mismatches that are textual, not semantic (reconcile by regenerating `identities.tsv`
from PG15 only after a human reads the diff); `config.toml` `[auth] site_url` is `http://localhost:3000`
while the app previews on 8080 (set `additional_redirect_urls` or override via CLI env, not by editing
`project_id`).

### PR-C `test(e2e): LMS acceptance matrix` (depends on PR-B green)

The existing visual suite is `e2e/visual/visual-regression.spec.ts` at 1280×800 for login, blog and
the resume analyzer; it is not LMS acceptance and stays untouched. New specs under
`e2e/lms-acceptance/`, run only by the isolated workflow (a dedicated Playwright project with
`testMatch: ['**/lms-acceptance/**']`), each at **1440×900, 390×844 and 768×1024**, each asserting on
fixture content that only exists after real reads resolve and that the error card is absent:

| Persona | Flow | Meaningful assertions |
|---|---|---|
| Public | `/courses`, `/courses/:id` | seeded course title and module titles visible; unpublished fixture course absent; "Enroll" CTA present when signed out |
| Student | sign in, `/enrolled-courses`, `/courses/:id/learn`, read a page, open the inline quiz, open the inline assignment | progress percentage changes after the page read; **inline quiz start succeeds or fails with the exact RLS error (T-08 repro)**; assignment submit creates a row visible in the UI; certificate page shows the locked state until every assessed item has a submission; started-only quiz behaviour recorded as observed (T-09) |
| Student | `/courses/:id/progress`, `/courses/:id/certificate` after completing all items legitimately | certificate issued once; verify page resolves the code |
| Instructor | `/course-management`, builder Setup/Curriculum/Students/Reports, Publish and Unpublish | roster lists the seeded learners; Reports KPIs equal counts computed from the seeded rows; catalog reflects publish state after reload; readiness guard blocks an empty course |
| Instructor | `/courses/:id/gradebook`, SpeedGrader | zero score shows as 0; latest attempt selected; CSV download parsed row-for-row against the table |
| Admin | `/admin/courses` | publish toggle respects the same readiness guard as the builder (T-11 once fixed) |
| Cross-course | instructor B signed in | direct PostgREST reads of course A learner rows return no rows (WP-02 acceptance A), both before and after the drafted RLS migration is applied to the local stack |

Evidence gate: every row is PASS, FAIL or BLOCKED with a real screenshot artifact at the three
viewports; no row may be reported from code reading.

## Production-mutating paths on `origin/main` today (inspected read-only, never triggered)

The handoff prohibits running Playwright seed or cleanup against production (Start Here line 29;
master plan lines 36, 108, 149, 490, 513). This is a requirement, not an owner choice. On
`origin/main` at `99f81e3e` these paths still exist:

| Path | Trigger | What it writes |
|---|---|---|
| `e2e.yml` "Seed E2E fixtures" | every `push` to `main`/`develop`, every `pull_request` to them, `workflow_dispatch` | `psql "$SUPABASE_DB_URL" -f e2e/fixtures/seed.sql` against the live project; then `global-setup.ts` resets the three `e2e-*` passwords through the `admin-users` function and the journeys insert and delete rows |
| `e2e.yml` visual baseline regeneration | `workflow_dispatch` with `update_snapshots=true` | `git commit` and `git push origin HEAD:<branch>` from the runner |
| `db-migrate.yml` | `workflow_dispatch` with `confirm: apply` | applies a named migration to the live database (by design; owner-driven) |

`nightly.yml`, `test.yml`, `security.yml` and `pr-checks.yml` do not write to the project.

On this branch the first path is already closed: `e2e.yml` runs `assert-safe-target.mjs --mutating`
before the seed, calls `scripts/e2e/seed.sh`, has no production opt-in of any kind, and the guard
accepts only loopback or a declared isolated project. Merging the reviewed safety checkpoint is what
removes the production-test path from `main`; the isolated job in PR-B is what replaces it. The
baseline-regeneration push remains in `e2e.yml` and is a separate write path to remove in PR-B's
review (the isolated workflow carries no commit or push step at all).

## Prerequisites that are not in this repository today

- Owner confirmation to commit the sanitized schema snapshot (PR-A step 1; scan attached: no secrets,
  no e-mail addresses, no UUID literals, no data rows; one public reference URL to bls.gov in a column
  default; the production project ref appears nowhere in the artifact).
- A maintainer to review PR-B's workflow file before the first PR run, because `pull_request`
  workflows execute on the PR's own copy; the file must carry no secret references and read-only
  permissions, which review confirms.

## What this plan does not do

- Does not touch `supabase/config.toml` `project_id`, repository secrets, variables or settings.
- Does not create hosted projects or accounts.
- Does not claim the stack exists or that any browser-tier acceptance has been achieved.
