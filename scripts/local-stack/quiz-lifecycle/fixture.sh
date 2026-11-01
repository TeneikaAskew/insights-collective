#!/usr/bin/env bash
# ABOUTME: Applies fixture.sql behind fail-closed guards: synthetic password required, readable source, strict local DSN,
# ABOUTME: mutating target guard. No secret in any argv; child output is captured privately and only allow-listed lines print.
# Usage: fixture.sh                               reads SUPABASE_DB_URL and E2E_TEST_PASSWORD from the environment
#        fixture.sh --no-target-guard             LOCAL-SHIM self-test only (plain PostgreSQL; the app env is absent).
#        The DSN is always read from SUPABASE_DB_URL, never from an argument, so it cannot appear in any argv.
#
# Secrets: the DB password goes to psql through PGPASSWORD in psql's own environment, and the synthetic learner
# password through psql's STDIN (a dollar-quoted literal written by the bash builtin printf). Neither is ever an argument
# of any process. psql's stdout and stderr go to a private (0600) temp file; on success only the fixture's own
# "quiz-lifecycle fixture:" notice is printed, on failure only the fixture's own RAISE text, else a byte count.
set -u
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
SRC="$HERE/fixture.sql"
DB="${SUPABASE_DB_URL:-}"; GUARD=1
[ $# -le 1 ] || { echo "fixture refused: unexpected argument"; exit 2; }
if [ "${1:-}" = "--no-target-guard" ]; then GUARD=0; elif [ -n "${1:-}" ]; then echo "fixture refused: unexpected argument"; exit 2; fi
PW="${E2E_TEST_PASSWORD:-}"
[ -n "$PW" ] || { echo "fixture refused: E2E_TEST_PASSWORD is empty"; exit 2; }
case "$PW" in *'$qlcpw$'*) echo "fixture refused: password contains the quoting tag"; exit 2 ;; esac
[ -n "$DB" ] || { echo "fixture refused: no database URL"; exit 2; }
[ -f "$SRC" ] && [ -r "$SRC" ] && [ -s "$SRC" ] || { echo "fixture refused: fixture.sql is not a readable, non-empty file"; exit 4; }
SPLIT=$(printf '%s' "$DB" | node "$HERE/local-dsn.mjs" split 2>/dev/null) || { echo "fixture refused: not a strict local DSN"; exit 2; }
CONN=$(sed -n 1p <<<"$SPLIT"); DBPW=$(sed -n 2p <<<"$SPLIT"); unset SPLIT
if [ "$GUARD" = 1 ]; then
  node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || { echo "fixture refused: target guard failed"; exit 3; }
fi
OUT=$(mktemp); trap 'rm -f "$OUT"' EXIT
{
  printf '%s\n' "select set_config('e2e.password', \$qlcpw\$${PW}\$qlcpw\$, false) is not null as bridged \\gset"
  cat "$SRC" || exit 5
} | env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE PGPASSWORD="$DBPW" \
      psql "$CONN" -X -q -v ON_ERROR_STOP=1 -f - >"$OUT" 2>&1
st=("${PIPESTATUS[@]}")
unset DBPW
if [ "${st[0]}" -ne 0 ]; then echo "FAIL fixture: producer exit ${st[0]}"; exit 1; fi
if [ "${st[1]}" -ne 0 ]; then
  msg=$(grep -oE 'quiz-lifecycle fixture: [A-Za-z0-9 ,;:()/._-]+' "$OUT" | head -1)
  echo "FAIL fixture: psql exit ${st[1]}${msg:+ ($msg)} ($(wc -c < "$OUT") bytes of output withheld)"
  exit 1
fi
grep -oE 'quiz-lifecycle fixture: learner, course, [0-9]+ quizzes, 0 attempts' "$OUT" | head -1
echo "PASS fixture"
