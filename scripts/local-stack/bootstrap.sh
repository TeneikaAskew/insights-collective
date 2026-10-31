#!/usr/bin/env bash
# ABOUTME: Applies the sanitized schema snapshot onto an AUTHENTIC local Supabase stack (`supabase start`)
# ABOUTME: whose database has the real managed roles and auth/storage schemas. Loopback only. Fails on
# ABOUTME: any DDL error and on any identity mismatch. This is the inverse of scripts/local-db
# ABOUTME: (which REFUSES managed roles and installs shims); the two can never be confused.
# Usage: scripts/local-stack/bootstrap.sh <loopback libpq DSN of the local stack database>
set -u
PGURL="${1:?loopback DSN required}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; SNAP="$ROOT/scripts/local-stack/schema"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGURL" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
if ! probe=$(psql "$PGURL" -Atc "select count(*) from pg_roles where rolname in ('supabase_auth_admin','supabase_storage_admin','authenticator')" 2>&1); then
  echo "cannot connect to the local stack database: $probe" >&2; exit 2; fi
if [ "$probe" != "3" ]; then echo "refusing: managed Supabase roles are absent ($probe of 3); this is not an authentic local stack. For a plain PostgreSQL use scripts/local-db/build-from-snapshot.sh" >&2; exit 2; fi
# Roles are cluster-wide, so their presence alone cannot distinguish a real stack from a shim database on
# the same cluster. On an authentic stack GoTrue and Storage own their schemas; the shim's are owned by postgres.
owners=$(psql "$PGURL" -Atc "select string_agg(nspname||'='||nspowner::regrole::text, ',' order by nspname) from pg_namespace where nspname in ('auth','storage')")
if [ "$owners" != "auth=supabase_auth_admin,storage=supabase_storage_admin" ]; then echo "refusing: auth/storage schemas are not owned by the managed roles (${owners:-missing}); this is not an authentic local stack" >&2; exit 2; fi
if [ "$(psql "$PGURL" -Atc "select count(*) from pg_tables where schemaname='public'")" != "0" ]; then echo "refusing: public schema is not empty" >&2; exit 2; fi
# Deny identity check, independent of config.toml: the snapshot artifact must not name the production project.
if grep -rqE "[a-z]{20}\.supabase\.co" "$SNAP"; then echo "refusing: snapshot artifact embeds a hosted project host" >&2; exit 2; fi
ERRLOG=$(mktemp); FAIL=0
BENIGN='already exists|multiple primary keys for table'
. "$SNAP/manifest.env"
if [ -n "${VIEWS_BROKEN_LIVE:-}" ]; then BENIGN="$BENIGN|relation \"(public\\.)?($(echo "$VIEWS_BROKEN_LIVE" | tr ',' '|'))\" does not exist"; fi
run_strict() { psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$1" >>"$ERRLOG" 2>&1 || { echo "FATAL in $(basename "$1"):"; grep ERROR "$ERRLOG" | tail -3; FAIL=1; }; }
run_passes() { local f="$1" errs; for _ in 1 2 3 4 5 6; do errs=$(psql "$PGURL" -q -f "$f" 2>&1 | grep ERROR | grep -vE "$BENIGN" | wc -l); [ "$errs" = "0" ] && return 0; done
  echo "FATAL: $(basename "$f") still has $errs real error(s)"; psql "$PGURL" -q -f "$f" 2>&1 | grep ERROR | grep -vE "$BENIGN" | sort | uniq -c | head -10; FAIL=1; }
run_strict "$SNAP/01_types_tables.sql"
run_passes "$SNAP/03_functions.sql"
run_passes "$SNAP/02_constraints_indexes_views.sql"
run_passes "$SNAP/02_constraints_indexes_views.sql"
run_strict "$SNAP/04_rls_policies.sql"
run_passes "$SNAP/05_triggers_grants.sql"
run_strict "$ROOT/scripts/local-stack/localize.sql"
[ $FAIL -ne 0 ] && { echo "BOOTSTRAP FAILED: incomplete schema replay"; exit 1; }
"$ROOT/scripts/local-stack/verify-identities.sh" "$PGURL" || { echo "BOOTSTRAP FAILED: identity verification"; exit 1; }
echo "bootstrap OK on $(psql "$PGURL" -Atc 'show server_version')"
