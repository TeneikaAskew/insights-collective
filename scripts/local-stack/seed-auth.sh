#!/usr/bin/env bash
# ABOUTME: Applies scripts/local-stack/auth-fixtures.sql behind the same fail-closed target guard as
# ABOUTME: scripts/e2e/seed.sh, with the synthetic E2E_TEST_PASSWORD bridged into e2e.password. Loopback only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/scripts/local-stack/auth-fixtures.sql"
[ -n "${E2E_TEST_PASSWORD:-}" ] || { echo "seed-auth refused: E2E_TEST_PASSWORD is empty" >&2; exit 2; }
# Preflight (see scripts/e2e/seed.sh): a missing/unreadable file would reach psql as the preamble alone, exit 0.
[ -f "$SRC" ] && [ -r "$SRC" ] && [ -s "$SRC" ] || { echo "seed-auth refused: $SRC is not a readable, non-empty regular file" >&2; exit 4; }
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating || { echo "seed-auth refused: target guard failed" >&2; exit 3; }
{ printf '%s\n' "select set_config('e2e.password', :'e2e_password', false) is not null as e2e_password_bridged \\gset"
  cat "$SRC"; } |
  env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE \
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v e2e_password="$E2E_TEST_PASSWORD" -f -
