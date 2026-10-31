# Disposable local database for RLS, trigger and seed rehearsals

Everything here runs against a plain PostgreSQL on loopback. Every script refuses a connection
string that is not `127.0.0.1`, `localhost` or a `/tmp` socket, so none of it can reach a Supabase
project. No file in this folder contains credentials or user data.

Why a snapshot and not a migration replay: the base tables (`courses`, `profiles`, `blog_posts`,
…) predate the first file in `supabase/migrations/`, so `replay-migrations.sh` applies only 28 of
233 files. The snapshot path reproduces the live schema exactly.

## Build

1. Start a local cluster (PostgreSQL 16 was used):
   `initdb -D /tmp/pgdata` then `pg_ctl -D /tmp/pgdata -o "-p 54329 -c listen_addresses=127.0.0.1" start`.
2. Produce a schema snapshot directory with five files, `01_types_tables.sql`, `02_constraints_indexes_views.sql`,
   `03_functions.sql`, `04_rls_policies.sql`, `05_triggers_grants.sql`, from **read-only catalog
   queries** against the project (`pg_type`, `pg_attribute`, `pg_constraint`, `pg_indexes`,
   `pg_get_functiondef`, `pg_policies`, `pg_get_triggerdef`, `role_table_grants`). Keep the
   snapshot outside the repository and scan it for secret-shaped strings before use.
3. `createdb ic_snapshot` then `scripts/local-db/build-from-snapshot.sh postgresql://postgres@127.0.0.1:54329/ic_snapshot <snapshot dir>`.

## Use

- `scripts/local-db/run-sql-tests.sh <loopback url>` runs every `tests/*.sql`; each prints `PASS`/`FAIL`
  lines and exits non-zero on failure. Tests impersonate users the way PostgREST does
  (`set_config('request.jwt.claims', …)` plus `set role authenticated`) and roll back.
- `scripts/local-db/local-preseed.sql` supplies the rows `e2e/fixtures/seed.sql` assumes already
  exist in production (reference course, modules, the three `e2e-*` accounts) so the seed can be
  rehearsed offline: `psql <url> -f scripts/local-db/local-preseed.sql` then
  `psql <url> -v ON_ERROR_STOP=1 -v e2e_password=local-only -f e2e/fixtures/seed.sql`.
- To try a drafted migration: apply it to the local database with `psql -f`, rerun the tests, and
  keep a second database built without it as the baseline.

## Limits

This is not a Supabase stack: no PostgREST, no GoTrue, no storage API, no realtime, no Edge
Functions. It validates SQL-level behaviour (policies, triggers, functions, seeds). Browser E2E
still needs an API in front of a database, which this folder does not provide.
