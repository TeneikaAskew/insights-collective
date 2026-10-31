#!/usr/bin/env bash
# ABOUTME: Builds a LOCAL database from a schema snapshot directory (01..05 DDL files produced from
# ABOUTME: read-only catalog queries) plus the Supabase shim, for RLS/trigger/seed rehearsals offline.
# Usage: scripts/local-db/build-from-snapshot.sh <loopback libpq url of an EMPTY database> <snapshot dir>
set -u
PGURL="${1:?url}"; SNAP="${2:?snapshot dir}"
case "$PGURL" in *127.0.0.1*|*localhost*|*/tmp/*) ;; *) echo "refusing: not loopback" >&2; exit 2;; esac
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-db/supabase-shim.sql" || exit 1
psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$SNAP/01_types_tables.sql" || exit 1
for pass in 1 2 3 4 5; do
  ERR=$(psql "$PGURL" -q -f "$SNAP/03_functions.sql" 2>&1 | grep -c ERROR); [ "$ERR" = "0" ] && break
done
psql "$PGURL" -q -f "$SNAP/02_constraints_indexes_views.sql" 2>&1 | grep ERROR | grep -v "already exists" | head -5
psql "$PGURL" -q -f "$SNAP/04_rls_policies.sql" 2>&1 | grep ERROR | head -5
psql "$PGURL" -q -f "$SNAP/05_triggers_grants.sql" 2>&1 | grep ERROR | grep -vE "already exists|quiz_analytics" | head -5
psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-db/post-functions.sql" || exit 1
psql "$PGURL" -Atc "select 'tables '||count(*) from pg_tables where schemaname='public' union all select 'policies '||count(*) from pg_policies where schemaname='public' union all select 'triggers '||count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where nspname in ('public','auth') and not tgisinternal"
