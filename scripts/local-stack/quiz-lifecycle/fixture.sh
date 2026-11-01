#!/usr/bin/env bash
# ABOUTME: Applies fixture.sql behind fail-closed guards: synthetic password required, readable source, strict local DSN,
# ABOUTME: mutating target guard. No secret in any argv; child output is captured privately and only allow-listed lines print.
# Usage: fixture.sh                               reads SUPABASE_DB_URL and E2E_TEST_PASSWORD from the environment
#        fixture.sh --no-target-guard             LOCAL-SHIM self-test only (plain PostgreSQL; the app env is absent).
#        The DSN is always read from SUPABASE_DB_URL, never from an argument, so it cannot appear in any argv.
#
# Secrets: the DB password is exported as PGPASSWORD by bash builtins inside a subshell that then execs psql, so it
# lives only in psql's process environment (no `env VAR=...` argv anywhere). The synthetic learner password reaches psql
# through STDIN (a dollar-quoted literal written by the builtin printf). Neither is ever an argument of any process;
# tests/isolation-selftest.sh traces every execve of the whole child chain to prove it. psql's stdout and stderr go to
# a private (0600) temp file and are NEVER printed: success prints a fixed line, failure a fixed message chosen by code
# (F01-F06 for the fixture's own RAISEs, F00 otherwise) and a byte count. No free-form text from psql is echoed.
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
# Parameter expansion only (no here-string temp file, no sed argv).
CONN=${SPLIT%%$'\n'*}; DBPW=${SPLIT#*$'\n'}; unset SPLIT
if [ "$GUARD" = 1 ]; then
  node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || { echo "fixture refused: target guard failed"; exit 3; }
fi
OUT=$(mktemp); trap 'rm -f "$OUT"' EXIT
{
  printf '%s\n' "select set_config('e2e.password', \$qlcpw\$${PW}\$qlcpw\$, false) is not null as bridged \\gset"
  cat "$SRC" || exit 5
} | (
  unset PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGPORT PGPASSFILE
  export PGPASSWORD="$DBPW"
  exec psql "$CONN" -X -q -v ON_ERROR_STOP=1 -f - >"$OUT" 2>&1
)
st=("${PIPESTATUS[@]}")
unset DBPW
bytes=$(wc -c < "$OUT" | tr -d ' ')
if [ "${st[0]}" -ne 0 ]; then echo "FAIL fixture [P01]: the SQL producer failed (exit ${st[0]}); $bytes bytes of psql output withheld"; exit 1; fi
if [ "${st[1]}" -ne 0 ]; then
  # Fixed messages only. A match picks the message; nothing of the matched line is printed.
  code=F00; text="psql failed"
  has() { grep -qF "ERROR:  quiz-lifecycle fixture: $1" "$OUT"; }
  if has 'e2e.password is empty'; then code=F01; text="e2e.password is empty"
  elif has 'the learner already holds attempts'; then code=F02; text="the learner already holds attempts; this stack is used"
  elif has 'learner row '; then code=F03; text="learner row not prepared"
  elif has 'expected 23 scenario quizzes'; then code=F04; text="scenario quiz count is not 23"
  elif has 'unlimited quizzes'; then code=F05; text="unlimited quizzes not prepared exactly once each"
  elif has 'an attempt exists after seeding'; then code=F06; text="an attempt exists after seeding"
  elif has 'expected 4 synthetic enrollments'; then code=F08; text="synthetic enrollments are not exactly 4"
  fi
  echo "FAIL fixture [$code]: $text (psql exit ${st[1]}; $bytes bytes of psql output withheld)"
  exit 1
fi
if grep -qF 'NOTICE:  quiz-lifecycle fixture: learner, course, 23 quizzes, 0 attempts' "$OUT"; then
  echo "fixture: learner, course, 23 quizzes, 0 attempts"
else
  echo "FAIL fixture [F07]: psql succeeded without the fixture's completion notice ($bytes bytes withheld)"; exit 1
fi
echo "PASS fixture"
