# Schema snapshot: origin, sanitization and omissions

**What this is.** Schema-only DDL of the live project's `public` schema, produced on 2026-10-31 by
read-only catalog queries (`pg_type`, `pg_attribute`/`pg_attrdef`, `pg_constraint`, `pg_indexes`,
`pg_class` views, `pg_get_functiondef`, `pg_policies`, `pg_get_triggerdef`, `role_table_grants`,
`has_function_privilege`). No table row was read or copied. `identities.tsv` holds one line per
function, policy, trigger, RLS flag, table grant and function grant with the md5 of its definition,
produced by the same query as `scripts/local-db/identities.sql`.

**Why a snapshot and not the migrations.** The base tables predate the first file in
`supabase/migrations/`; replaying the migrations from zero applies 28 of 233 files.

**Sanitization performed before committing (all checks empty unless noted):** secret-shaped strings
(JWT, `sk_live`, PEM blocks, bearer tokens, service-role keys): none. E-mail addresses: none. UUID
literals in function bodies: none. `INSERT` statements: 24, all inside function bodies (notification
and audit writers), no data rows. External destinations: one public reference URL
(`https://www.bls.gov/oes/`) in a column default of a reference table; the functions that call
`net.http_post` build their destination from `vault.decrypted_secrets` at run time, so no live host is
embedded. The production project ref does not appear in any file here.

**Omissions, deliberately and visibly:** `public.quiz_analytics` (self-referencing view, raises 42P17
on the live project) and its three role grants are excluded from identity verification by
`manifest.env` `VIEWS_BROKEN_LIVE`; the build reports the omission. Functions owned by extensions are
excluded from identity comparison. The `auth`, `storage`, `vault`, `cron`, `net` and `extensions`
schemas are **not** part of this snapshot: on a plain PostgreSQL they come from
`scripts/local-db/supabase-shim.sql`; on an authentic local stack they are the real managed services.

**Version note.** The live project runs PostgreSQL 15. The identity parity proof in this repository
was run on PostgreSQL 16 (`scripts/local-db`). Parity on PostgreSQL 15 is a gate the authentic
bootstrap must pass before any acceptance claim (`scripts/local-stack/verify-identities.sh`).
