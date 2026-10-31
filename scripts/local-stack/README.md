# Authentic local stack bootstrap (PR-A of `docs/lms/isolated-stack-plan.md`)

Applies the sanitized, schema-only snapshot in `schema/` onto a real local Supabase stack
(`supabase start`: PostgreSQL 15, GoTrue, PostgREST, Storage, Edge runtime) so Playwright can run
against something that is not production. Loopback only; no hosted project; no secrets.

- `schema/ORIGIN.md`: where the DDL came from, what was scanned, what is deliberately omitted.
- `bootstrap.sh <loopback DSN>`: validates the DSN with the repository's single libpq parser, then
  **requires** the managed roles and that `auth`/`storage` are owned by `supabase_auth_admin` /
  `supabase_storage_admin` (the inverse of `scripts/local-db/build-from-snapshot.sh`, which refuses
  them and installs shims; the two cannot be confused), refuses a non-empty `public` schema and any
  hosted-project host inside the artifact, applies the DDL failing on any real error, runs
  `localize.sql`, then `verify-identities.sh`.
- `localize.sql`: unschedules every cron job, points every vault secret the functions read at a
  loopback placeholder, creates the empty storage buckets the app expects.
- `verify-identities.sh <loopback DSN>`: object-by-object md5 comparison against `schema/identities.tsv`
  with the live-broken `quiz_analytics` omission reported explicitly. **PostgreSQL 15 parity gate:**
  the manifest was proven on PostgreSQL 16; the first run on a real `supabase start` database (PG15)
  must show 0 unexplained differences before any acceptance claim.
- `tests/bootstrap-negative.sh <loopback url without db>`: proves the authentic bootstrap refuses a
  shim database, the snapshot builder refuses a managed one, and runs a mechanics smoke of the
  bootstrap on a local database carrying the managed role names and ownership (PG16 here).

Not yet done, by design: no GitHub Actions workflow dispatches this; no `supabase start` has been run
(no Docker daemon in the authoring container). See the plan for PR-B and PR-C.
