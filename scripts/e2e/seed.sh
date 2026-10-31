#!/usr/bin/env bash
# ABOUTME: The ONLY supported way to apply e2e/fixtures/seed.sql. Runs the fail-closed target guard
# ABOUTME: (loopback or the declared isolated project; production never) BEFORE psql is invoked, and
# ABOUTME: strips libpq environment overrides so the URL it checked is the URL psql uses.
# Env: SUPABASE_DB_URL (checked), VITE_SUPABASE_URL, E2E_RELAY_TARGET, E2E_ISOLATED_TARGET_REF, E2E_TEST_PASSWORD.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating || { echo "seed refused: target guard failed" >&2; exit 3; }
# The guard checked SUPABASE_DB_URL as written; a PGHOST/PGHOSTADDR/PGSERVICE in the environment could
# still redirect libpq, so psql runs with those removed.
exec env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v e2e_password="${E2E_TEST_PASSWORD:-}" -f "$ROOT/e2e/fixtures/seed.sql"
