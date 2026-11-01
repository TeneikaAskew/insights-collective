#!/usr/bin/env bash
# ABOUTME: The ONLY supported way to apply e2e/fixtures/seed.sql. Runs the fail-closed target guard
# ABOUTME: (loopback or the declared isolated project; production never) BEFORE psql is invoked, and
# ABOUTME: strips libpq environment overrides so the URL it checked is the URL psql uses.
# Env: SUPABASE_DB_URL (checked), VITE_SUPABASE_URL, E2E_RELAY_TARGET, E2E_ISOLATED_TARGET_REF, E2E_TEST_PASSWORD.
#
# The seed reads the journeys password with current_setting('e2e.password'). A psql `-v` variable is
# NOT a server setting, so `-v e2e_password=...` alone never reached it (measured: the seed saw NULL and
# gave the account a random password). The one-line preamble below copies the psql variable into the
# session setting before the seed runs. Line numbers in psql errors are therefore offset by one.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/e2e/fixtures/seed.sql"
# Preflight: psql reads the SQL from a pipe, so a missing or unreadable file would otherwise reach psql as
# just the one-line preamble, which it runs and then exits 0 on end of input. Refuse before any connection.
# pipefail (above) additionally fails the run if `cat` fails after this check (file removed mid-run).
[ -f "$SRC" ] && [ -r "$SRC" ] && [ -s "$SRC" ] || { echo "seed refused: $SRC is not a readable, non-empty regular file" >&2; exit 4; }
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating || { echo "seed refused: target guard failed" >&2; exit 3; }
# The guard checked SUPABASE_DB_URL as written; a PGHOST/PGHOSTADDR/PGSERVICE in the environment could
# still redirect libpq, so psql runs with those removed.
{ printf '%s\n' "select set_config('e2e.password', :'e2e_password', false) is not null as e2e_password_bridged \\gset"
  cat "$SRC"; } |
  env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE \
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v e2e_password="${E2E_TEST_PASSWORD:-}" -f -
