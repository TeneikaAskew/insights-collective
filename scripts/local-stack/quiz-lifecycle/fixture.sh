#!/usr/bin/env bash
# ABOUTME: Applies fixture.sql behind the same fail-closed guards as scripts/local-stack/seed-auth.sh: synthetic password
# ABOUTME: required, readable source, loopback DSN, mutating target guard. psql exit status is propagated, never inferred.
# Usage: fixture.sh            (reads SUPABASE_DB_URL and E2E_TEST_PASSWORD from the environment)
#        fixture.sh --no-target-guard <dsn>   LOCAL-SHIM self-test only: plain PostgreSQL, the app env is absent there.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
SRC="$HERE/fixture.sql"
DB="${SUPABASE_DB_URL:-}"; GUARD=1
if [ "${1:-}" = "--no-target-guard" ]; then GUARD=0; DB="${2:?dsn}"; fi
[ -n "${E2E_TEST_PASSWORD:-}" ] || { echo "fixture refused: E2E_TEST_PASSWORD is empty" >&2; exit 2; }
[ -n "$DB" ] || { echo "fixture refused: no database URL" >&2; exit 2; }
[ -f "$SRC" ] && [ -r "$SRC" ] && [ -s "$SRC" ] || { echo "fixture refused: $SRC is not a readable, non-empty file" >&2; exit 4; }
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$DB" >/dev/null || { echo "fixture refused: not a loopback DSN" >&2; exit 2; }
if [ "$GUARD" = 1 ]; then
  node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating || { echo "fixture refused: target guard failed" >&2; exit 3; }
fi
{ printf '%s\n' "select set_config('e2e.password', :'e2e_password', false) is not null as e2e_password_bridged \\gset"
  cat "$SRC"; } |
  env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE \
    psql "$DB" -X -q -v ON_ERROR_STOP=1 -v e2e_password="$E2E_TEST_PASSWORD" -f - 2>&1 | sed -E 's/^.*NOTICE: *//'
st=${PIPESTATUS[1]}
[ "$st" -eq 0 ] || { echo "FAIL fixture: psql exit $st"; exit 1; }
echo "PASS fixture"
