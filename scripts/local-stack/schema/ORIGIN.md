# Schema snapshot: origin, sanitization and omissions

**What this is.** Schema-only DDL of the live project's `public` schema, produced on 2026-10-31 by
read-only catalog queries (`pg_type`, `pg_attribute`/`pg_attrdef`, `pg_constraint`, `pg_indexes`,
`pg_class` views, `pg_get_functiondef`, `pg_policies`, `pg_get_triggerdef`, `role_table_grants`,
`has_function_privilege`). No table row was read or copied. `identities.tsv` holds one line per
function, policy, trigger, RLS flag, table grant and function grant with the md5 of its definition,
produced by the same query as `scripts/local-db/identities.sql`, extended to eleven object kinds:
functions, policies, triggers, RLS flags, table grants, function grants, tables, columns (type, null
constraint and default expression), constraints, indexes and views, plus enums. What it does NOT cover:
sequences, comments, table/sequence ownership, storage parameters, and anything outside `public`.

**Why a snapshot and not the migrations.** The base tables predate the first file in
`supabase/migrations/`; replaying the migrations from zero applies 28 of 233 files.

**Sanitization performed before committing.** Scanned across ALL five DDL files, including column
defaults, constraints, indexes and view definitions (an earlier scan covered function bodies only and
its "no UUIDs" claim was wrong). Secret-shaped strings (JWT, `sk_live`, PEM blocks, bearer tokens,
service-role keys): none. E-mail addresses: none. `INSERT` statements: all inside function bodies
(notification, audit and availability writers); no data rows. External destinations: one public
reference URL (`https://www.bls.gov/oes/`) in a column default; the `net.http_post` callers build
their destination from `vault.decrypted_secrets` at run time. The production project ref appears
nowhere. **One production identity was found and removed:** `resources.created_by` carried a fixed
user-id UUID as its column default (live catalog line, not resolved or looked up). It is replaced by
no default and recorded in `DIVERGENCES.md`; the unsanitized form exists only in unpushed local
history and must not be published. Foreign keys to `auth.users(id)` are schema structure (54 of
them) and are kept; they resolve to the managed `auth` schema on an authentic stack.

**Omissions, deliberately and visibly:** `public.quiz_analytics` (self-referencing view, raises 42P17
on the live project) and its three role grants are **absent** locally; a local `SELECT` on it raises
42P01 undefined_table. The live recursion error is not reproduced, the object is omitted, and the
verifier reports the omission on every run (`DIVERGENCES.tsv`). Functions owned by extensions are
excluded from identity comparison. The `auth`, `storage`, `vault`, `cron`, `net` and `extensions`
schemas are **not** part of this snapshot: on a plain PostgreSQL they come from
`scripts/local-db/supabase-shim.sql`; on an authentic local stack they are the real managed services.

**Version note.** The live project runs PostgreSQL 15. The identity parity proof in this repository
was run on PostgreSQL 16 (`scripts/local-db`). Parity on PostgreSQL 15 is a gate the authentic
bootstrap must pass before any acceptance claim (`scripts/local-stack/verify-identities.sh`).
