#!/usr/bin/env bash
# ABOUTME: Runs scripts/local-db/tests/*.sql against the LOCAL snapshot database and reports pass/fail.
# ABOUTME: Refuses any non-loopback connection string so it can never target a Supabase project.
set -u
PGURL="${1:?connection string required}"; shift || true
ROOT_FOR_GUARD="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT_FOR_GUARD/scripts/local-db/assert-local-dsn.mjs" "$PGURL" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; rc=0
if [ "$#" -gt 0 ]; then FILES=("$@"); else FILES=("$ROOT"/scripts/local-db/tests/*.sql); fi
for f in "${FILES[@]}"; do
  echo "== $(basename "$f")"
  out=$(psql "$PGURL" -qAt -f "$f" 2>&1); st=$?
  echo "$out" | grep -E "^(PASS|FAIL) |ERROR" | sed 's/^/   /'
  # A printed FAIL line fails the file even when psql exited 0 (06 printed six FAILs and exited 0 before it raised).
  nfail=$(echo "$out" | grep -c "^FAIL ")
  if [ $st -ne 0 ]; then echo "   -> FAILED (exit $st)"; rc=1
  elif [ "$nfail" -gt 0 ]; then echo "   -> FAILED ($nfail FAIL line(s), psql exit 0)"; rc=1
  else echo "   -> OK"; fi
done
exit $rc
