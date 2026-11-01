#!/usr/bin/env bash
# ABOUTME: T-09 runtime STAGE APP: runs AFTER the snapshot bootstrap. Verifies (never writes) bootstrap's vault values, application
# ABOUTME: sentinels (vault callers, fanout inventory, synthetic scratch fanout unit), the reviewed migrations, SQL tier.
# Usage: stage-app.sh <loopback db url> OLD|NEW [allow_shim]
# The guard must already be installed by stage-pre.sh. Exit 0 only if every step passes.
set -u
DB="${1:?loopback db url}"; MODE="${2:?OLD or NEW}"; ALLOW_SHIM="${3:-0}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$DB" >/dev/null || { echo "FAIL app: not a loopback DSN"; exit 2; }
case "$MODE" in OLD|NEW) ;; *) echo "FAIL app: mode must be OLD or NEW"; exit 2 ;; esac
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
run() {
  local label="$1"; shift; local out st
  out=$(psql "$DB" -v allow_shim="$ALLOW_SHIM" "$@" 2>&1); st=$?
  grep -E "egress-verify OK|^SENTINEL|ERROR|required" <<<"$out" | sed 's/^.*NOTICE: *//'
  [ $st -eq 0 ] || { echo "FAIL app: $label (psql exit $st)"; exit 1; }
  echo "PASS app: $label"
}
pipe() { # label, command...; streams the command's lines, fails on its status
  local label="$1"; shift
  "$@" 2>&1 | grep -v assert-local; [ "${PIPESTATUS[0]}" -eq 0 ] || { echo "FAIL app: $label"; exit 1; }
  echo "PASS app: $label"
}
# Vault is NOT written here. bootstrap.sh (localize.sql) already created each referenced name once with the loopback
# placeholder (Vault names are unique); this stage only VERIFIES that exact set and those exact values.
run "verify stage=app after bootstrap (exact vault names and values as bootstrap wrote them)"         -v stage=app -q -f "$HERE/egress-verify.sql"
run "sentinels stage=app before migrations"    -v stage=app -qAt -f "$HERE/egress-sentinels.sql"
pipe "reviewed migrations ($MODE), guard re-verified inside" "$HERE/apply-reviewed.sh" "$DB" "$MODE" "$ALLOW_SHIM"
run "sentinels stage=app after migrations"     -v stage=app -qAt -f "$HERE/egress-sentinels.sql"
pipe "SQL tier ($MODE)" "$HERE/sql-tier.sh" "$DB" "$MODE"
run "verify stage=app at teardown"             -v stage=app -q -f "$HERE/egress-verify.sql"
echo "== STAGE APP ($MODE): ALL PASS"
