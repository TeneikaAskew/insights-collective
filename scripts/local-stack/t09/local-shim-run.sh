#!/usr/bin/env bash
# ABOUTME: LOCAL-SHIM end-to-end order on a plain PostgreSQL using the SAME stage scripts as CI: fanout source inventory,
# ABOUTME: stage-pre (guard, queue-only verify, net.* sentinels), then stage-app. NOT pg_net acceptance.
# Usage: local-shim-run.sh <loopback maintenance url, e.g. postgresql://postgres@127.0.0.1:54329/postgres> <template db> OLD|NEW
# DISPOSABLE ONLY: drops and recreates the database t09r_<mode>. Never point it at an existing or shared stack.
# Difference from CI, stated: the template already holds the snapshot, so here the application schema exists during
# stage-pre; in CI stage-pre runs before bootstrap.sh creates it. Stage-pre reads neither, so the order is the same.
set -u
BASE="${1:?maintenance url}"; TEMPLATE="${2:?template}"; MODE="${3:?OLD or NEW}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$BASE" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
DB_NAME="t09r_$(tr 'A-Z' 'a-z' <<<"$MODE")"; DB="${BASE%/*}/$DB_NAME"
die() { echo "FAIL $*"; exit 1; }
"$HERE/fanout-inventory.sh" || die "fanout inventory"
psql "$BASE" -qc "drop database if exists $DB_NAME" -qc "create database $DB_NAME template $TEMPLATE" >/dev/null 2>&1 || die "clone"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/pgnet-queue-shim.sql" >/dev/null 2>&1 || die "shim"
# A fresh `supabase start` vault holds none of the frozen names; the template is brought to the same state.
psql "$DB" -v ON_ERROR_STOP=1 -qc "delete from vault.secrets" >/dev/null || die "vault reset"
echo "-- STAGE PRE (LOCAL-SHIM)"; "$HERE/stage-pre.sh" "$DB" 1 || die "stage pre"
echo "-- (CI: bootstrap.sh + verify-identities.sh run here)"
echo "-- STAGE APP $MODE (LOCAL-SHIM)"; "$HERE/stage-app.sh" "$DB" "$MODE" 1 || die "stage app"
echo "== LOCAL-SHIM run $MODE: ALL STEPS PASS (not pg_net acceptance)"
