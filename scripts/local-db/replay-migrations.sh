#!/usr/bin/env bash
# ABOUTME: Replays supabase/migrations/*.sql in version order onto a LOCAL disposable Postgres and
# ABOUTME: records which files applied cleanly, so RLS/trigger tests run against the repo's real schema.
# Usage: scripts/local-db/replay-migrations.sh "<libpq connection string to the LOCAL cluster>"
# Refuses to run against anything that is not loopback: this is a local-only tool by design.
set -u
PGURL="${1:?connection string required}"
ROOT_FOR_GUARD="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT_FOR_GUARD/scripts/local-db/assert-local-dsn.mjs" "$PGURL" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
if psql "$PGURL" -Atc "select 1" >/dev/null 2>&1; then :; else echo "cannot connect" >&2; exit 2; fi
# Belt and braces: a Supabase-hosted database identifies itself by these roles/schemas.
if [ "$(psql "$PGURL" -Atc "select count(*) from pg_roles where rolname in ('supabase_auth_admin','supabase_storage_admin','authenticator')")" != "0" ]; then
  echo "refusing: this looks like a real Supabase database, not the local shim" >&2; exit 2
fi
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-db/supabase-shim.sql" || { echo "shim failed" >&2; exit 1; }
OK=0; FAIL=0; : > /tmp/replay-failures.txt
for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
  base=$(basename "$f"); ver=$(echo "$base" | sed -E 's/^([0-9]+).*/\1/')
  if psql "$PGURL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$f" > /tmp/replay-one.log 2>&1; then
    OK=$((OK+1))
    psql "$PGURL" -Atq -c "insert into supabase_migrations.schema_migrations(version,name) values ('$ver','$base') on conflict do nothing" >/dev/null
  else
    FAIL=$((FAIL+1)); echo "== $base" >> /tmp/replay-failures.txt; grep -E "ERROR|DETAIL" /tmp/replay-one.log | head -3 >> /tmp/replay-failures.txt
  fi
done
echo "applied=$OK failed=$FAIL (details: /tmp/replay-failures.txt)"
