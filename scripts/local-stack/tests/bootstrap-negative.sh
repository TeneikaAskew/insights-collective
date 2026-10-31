#!/usr/bin/env bash
# ABOUTME: The two bootstraps must never be confusable: the authentic bootstrap refuses a shim database
# ABOUTME: (no managed roles) and the snapshot builder refuses a database that has managed roles.
# ABOUTME: Also a mechanics smoke run of the authentic bootstrap on a local database that carries the
# ABOUTME: managed role names plus real-shaped auth/storage schemas (PG16 here; PG15 parity is a gate).
set -u
PGBASE="${1:?loopback libpq url WITHOUT database}"; ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; rc=0
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGBASE/postgres" >/dev/null || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
mk() { psql "$PGBASE/postgres" -qc "drop database if exists $1" >/dev/null 2>&1; psql "$PGBASE/postgres" -qc "create database $1" >/dev/null; }
say() { if [ "$2" -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1"; rc=1; fi; }
# 1) authentic bootstrap refuses a plain/shim database (no managed roles)
mk ls_shim; psql "$PGBASE/ls_shim" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-db/supabase-shim.sql" >/dev/null
out=$("$ROOT/scripts/local-stack/bootstrap.sh" "$PGBASE/ls_shim" 2>&1); st=$?
[ $st -ne 0 ] && echo "$out" | grep -qE "managed Supabase roles are absent|not owned by the managed roles"; say "authentic bootstrap refuses a shim database (no managed roles, or schemas not owned by them)" $?
# 2) snapshot builder refuses a database WITH managed roles
for r in supabase_auth_admin supabase_storage_admin authenticator; do
  [ "$(psql "$PGBASE/postgres" -Atc "select count(*) from pg_roles where rolname='$r'")" = "1" ] || psql "$PGBASE/postgres" -qc "create role $r nologin" >/dev/null
done
mk ls_managed
out=$("$ROOT/scripts/local-db/build-from-snapshot.sh" "$PGBASE/ls_managed" /tmp/does-not-matter 2>&1); st=$?
[ $st -ne 0 ] && echo "$out" | grep -q "looks like a real Supabase database"; say "snapshot builder refuses a database with managed roles" $?
# 3) mechanics smoke: managed roles present + real-shaped auth/storage/vault/cron from the shim (schemas only), then bootstrap
psql "$PGBASE/ls_managed" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-db/supabase-shim.sql" >/dev/null 2>&1
psql "$PGBASE/ls_managed" -qc "alter schema auth owner to supabase_auth_admin; alter schema storage owner to supabase_storage_admin" >/dev/null
out=$("$ROOT/scripts/local-stack/bootstrap.sh" "$PGBASE/ls_managed" 2>&1); st=$?
echo "$out" | tail -3 | sed 's/^/   /'; say "authentic bootstrap applies the snapshot and verifies identities (mechanics smoke, PG16)" $st
psql "$PGBASE/ls_managed" -Atc "select 'cron jobs remaining: '||count(*) from cron.job; select 'vault placeholders: '||count(*) from vault.secrets; select 'buckets: '||count(*) from storage.buckets" | sed 's/^/   /'
for db in ls_shim ls_managed; do psql "$PGBASE/postgres" -qc "drop database if exists $db" >/dev/null 2>&1; done
echo "bootstrap-negative: exit $rc"; exit $rc
