#!/usr/bin/env bash
# ABOUTME: Runs scripts/local-db/tests/*.sql against the LOCAL snapshot database and reports pass/fail.
# ABOUTME: Refuses any non-loopback connection string so it can never target a Supabase project.
set -u
PGURL="${1:?connection string required}"; shift || true
case "$PGURL" in *127.0.0.1*|*localhost*|*/tmp/*) ;; *) echo "refusing: not loopback" >&2; exit 2;; esac
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; rc=0
if [ "$#" -gt 0 ]; then FILES=("$@"); else FILES=("$ROOT"/scripts/local-db/tests/*.sql); fi
for f in "${FILES[@]}"; do
  echo "== $(basename "$f")"
  out=$(psql "$PGURL" -qAt -f "$f" 2>&1); st=$?
  echo "$out" | grep -E "^(PASS|FAIL) |ERROR" | sed 's/^/   /'
  if [ $st -ne 0 ]; then echo "   -> FAILED (exit $st)"; rc=1; else echo "   -> OK"; fi
done
exit $rc
