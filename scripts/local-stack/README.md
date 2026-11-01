# Authentic local stack bootstrap (PR-A of `docs/lms/isolated-stack-plan.md`)

Applies the sanitized, schema-only snapshot in `schema/` onto a real local Supabase stack
(`supabase start`: PostgreSQL 15, GoTrue, PostgREST, Storage, Edge runtime) so Playwright can run
against something that is not production. Loopback only; no hosted project; no secrets.

- `schema/ORIGIN.md`: where the DDL came from, what was scanned, what is deliberately omitted.
- `workdir.sh [dir]`: prepares a disposable CLI workdir (config.toml copied with only `[db.seed]
  enabled = false` written, so `project_id` keeps the guard's deny identity; EMPTY migrations directory;
  functions COPIED, and refused if the source tree holds any symlink) and prints the `supabase start
  --workdir` command without running it. It never deletes; it refuses existing targets and any symlink
  in the target's ancestry, and checks the repository boundary on the resolved physical path (also for
  `TMPDIR` in the no-argument form). Proof: `tests/workdir-negative.sh`, non-destructive. The historical migration chain must
  never run before the snapshot bootstrap.
- `bootstrap.sh <loopback DSN>`: validates the DSN with the repository's single libpq parser, then
  requires the authentic layout by **object ownership**: the seven managed roles, `auth.users`,
  `auth.identities`, `auth.schema_migrations` and `auth.uid()` owned by `supabase_auth_admin`,
  `storage.buckets`/`objects`/`migrations` owned by `supabase_storage_admin` (the official init creates
  the schemas `AUTHORIZATION supabase_admin`, so schema ownership is NOT the test). Inverse of
  `scripts/local-db/build-from-snapshot.sh`; the two cannot be confused. Refuses a non-empty `public`
  schema and any hosted host inside the artifact. Every `psql` exit status is propagated: FATAL or a
  lost connection fails the run even without an `ERROR` line. Then `localize.sql`, then
  `verify-identities.sh`. These ownership checks have NOT yet run against a real `supabase start`
  database; if that first run disagrees, the check is corrected, never relaxed.
- `localize.sql`: unschedules every cron job, sets a loopback placeholder for each DISTINCT vault secret
  name the functions read (create first time, `vault.update_secret` afterwards; names are unique),
  creates the empty storage buckets the app expects. Idempotent.
- `verify-identities.sh <loopback DSN>`: two labelled comparisons. **Live-verified** kinds (functions,
  policies, triggers, RLS flags, table and function grants) against `schema/identities.tsv`, read from the
  live catalog on 2026-10-31. **Snapshot-derived** kinds (tables, columns incl. defaults, constraints,
  indexes, views, enums) against `schema/identities-snapshot-derived.tsv`, produced by applying the
  sanitized DDL: it proves the DDL applies identically; its agreement with the current live catalog is
  **UNVERIFIED** (no further live reads were made). Declared divergences (`schema/DIVERGENCES.tsv`) are
  reported; anything else fails. **PostgreSQL 15 parity gate:** everything here ran on PostgreSQL 16;
  the first run on a real `supabase start` database (PG15) must pass before any acceptance claim.
- `schema/quiz_analytics` is omitted: a local `SELECT` raises 42P01 undefined_table; the live 42P17
  recursion is not reproduced.
- `tests/bootstrap-negative.sh <loopback url without db>` (PG16; managed layout SIMULATED by
  `tests/simulate-managed-stack.sql`, a fixture, not evidence about a real stack): mutual refusal of the
  two bootstraps; positive smoke; idempotent localization and unique vault names; fail-closed on a fake
  `psql` that exits 2 with FATAL during constraints/views and on partial identity output; parity catches a
  drifted column default and a drifted index; omission yields 42P01. Creates only the missing cluster
  roles and drops exactly those on exit.

Not yet done, by design: no GitHub Actions workflow dispatches this; no `supabase start` has been run
(no Docker daemon in the authoring container). See the plan for PR-B and PR-C.
