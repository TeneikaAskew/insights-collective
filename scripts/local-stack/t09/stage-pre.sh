#!/usr/bin/env bash
# ABOUTME: T-09 runtime STAGE PRE: runs right after `supabase start` and BEFORE any bootstrap write. Installs the queue guard,
# ABOUTME: then queue-only verify and installed net.* sentinels. Needs no application function, vault secret or cron.
# Usage: stage-pre.sh <loopback db url> [allow_shim]   (allow_shim=1 only for the LOCAL-SHIM plain-PostgreSQL run; CI omits it)
# Exit 0 only if every step passes. Never grants, revokes, changes ownership or touches network settings.
set -u
DB="${1:?loopback db url}"; ALLOW_SHIM="${2:-0}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$DB" >/dev/null || { echo "FAIL pre: not a loopback DSN"; exit 2; }
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
run() { # label, then psql args; prints the result lines, fails on any non-zero psql status
  local label="$1"; shift; local out st
  out=$(psql "$DB" -v allow_shim="$ALLOW_SHIM" "$@" 2>&1); st=$?
  grep -E "egress-guard installed|egress-guard BLOCKER|egress-verify OK|^SENTINEL|ERROR|required" <<<"$out" | sed 's/^.*NOTICE: *//'
  [ $st -eq 0 ] || { echo "FAIL pre: $label (psql exit $st)"; exit 1; }
  echo "PASS pre: $label"
}
run "guard install (before any bootstrap write)" -q -f "$HERE/egress-guard.sql"
run "verify stage=pre (queue-only)"              -v stage=pre -q -f "$HERE/egress-verify.sql"
run "sentinels stage=pre (installed net.* only)" -v stage=pre -qAt -f "$HERE/egress-sentinels.sql"
run "verify stage=pre after sentinels"           -v stage=pre -q -f "$HERE/egress-verify.sql"
echo "== STAGE PRE: ALL PASS"
