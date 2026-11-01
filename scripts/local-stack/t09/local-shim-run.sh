#!/usr/bin/env bash
# ABOUTME: LOCAL-SHIM end-to-end order on a plain PostgreSQL: fresh clone, queue shim, vault placeholders, guard, verify,
# ABOUTME: sentinels, the reviewed migrations, verify, sentinels, SQL tier, verify. Mirrors the CI order; NOT pg_net acceptance.
# Usage: local-shim-run.sh <loopback maintenance url, e.g. postgresql://postgres@127.0.0.1:54329/postgres> <template db> OLD|NEW
# DISPOSABLE ONLY: drops and recreates the database t09r_<mode>. Never point it at an existing or shared stack.
set -u
BASE="${1:?maintenance url}"; TEMPLATE="${2:?template}"; MODE="${3:?OLD or NEW}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$BASE" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
DB_NAME="t09r_$(tr 'A-Z' 'a-z' <<<"$MODE")"; DB="${BASE%/*}/$DB_NAME"
step() { echo "-- $*"; }
die() { echo "FAIL $*"; exit 1; }
psql "$BASE" -qc "drop database if exists $DB_NAME" -qc "create database $DB_NAME template $TEMPLATE" >/dev/null 2>&1 || die "clone"
step "1 queue shim (LOCAL-SHIM) + vault placeholders"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/pgnet-queue-shim.sql" >/dev/null 2>&1 || die "shim"
psql "$DB" -v ON_ERROR_STOP=1 -qAtc "delete from vault.secrets; select count(*) from (select vault.create_secret('http://127.0.0.1:1/local-placeholder', n) from unnest(array['coursera_refresh_secret','coursera_refresh_url','notification_digest_url','notification_email_secret','notification_email_url']) n) x" >/dev/null || die "vault"
step "2 guard (before any bootstrap or migration write)"
psql "$DB" -v allow_shim=1 -qAt -f "$HERE/egress-guard.sql" 2>&1 | grep -E "installed|ERROR" || die "guard"
step "3 verify + sentinels before migrations"
psql "$DB" -v allow_shim=1 -q -f "$HERE/egress-verify.sql" 2>&1 | grep -o "egress-verify.*" ; [ "${PIPESTATUS[0]}" -eq 0 ] || die "verify-1"
psql "$DB" -qAt -f "$HERE/egress-sentinels.sql" 2>&1 | grep -E "^SENTINEL|ERROR"; [ "${PIPESTATUS[0]}" -eq 0 ] || die "sentinels-1"
step "4 reviewed migrations ($MODE)"
"$HERE/apply-reviewed.sh" "$DB" "$MODE" 1 2>&1 | grep -v assert-local || true
[ "${PIPESTATUS[0]}" -eq 0 ] || die "apply"
step "5 sentinels after migrations"
psql "$DB" -qAt -f "$HERE/egress-sentinels.sql" 2>&1 | grep -E "^SENTINEL (entry|vault|fanout)|ERROR"; [ "${PIPESTATUS[0]}" -eq 0 ] || die "sentinels-2"
step "6 SQL tier ($MODE)"
"$HERE/sql-tier.sh" "$DB" "$MODE" 2>&1 | grep -vE "assert-local|old-negative"; [ "${PIPESTATUS[0]}" -eq 0 ] || die "sql-tier"
step "7 verify at teardown"
psql "$DB" -v allow_shim=1 -q -f "$HERE/egress-verify.sql" 2>&1 | grep -o "egress-verify.*"; [ "${PIPESTATUS[0]}" -eq 0 ] || die "verify-2"
echo "== LOCAL-SHIM run $MODE: ALL STEPS PASS (not pg_net acceptance)"
