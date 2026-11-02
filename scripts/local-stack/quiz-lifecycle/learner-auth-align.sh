#!/usr/bin/env bash
# ABOUTME: Applies the CANDIDATE learner-auth-align.sql behind the same fail-closed guards as fixture.sh (strict local DSN,
# ABOUTME: mutating target guard, password over stdin, private psql output, fixed messages). Called only by auth-gate.sh.
set -u
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
SRC="$HERE/learner-auth-align.sql"
DB="${SUPABASE_DB_URL:-}"
[ $# -eq 0 ] || { echo "align refused: unexpected argument"; exit 2; }
PW="${E2E_TEST_PASSWORD:-}"
[ -n "$PW" ] || { echo "align refused: E2E_TEST_PASSWORD is empty"; exit 2; }
case "$PW" in *'$qlcpw$'*) echo "align refused: password contains the quoting tag"; exit 2 ;; esac
[ -n "$DB" ] || { echo "align refused: no database URL"; exit 2; }
[ -f "$SRC" ] && [ -r "$SRC" ] && [ -s "$SRC" ] || { echo "align refused: learner-auth-align.sql is not readable"; exit 4; }
SPLIT=$(printf '%s' "$DB" | node "$HERE/local-dsn.mjs" split 2>/dev/null) || { echo "align refused: not a strict local DSN"; exit 2; }
CONN=${SPLIT%%$'\n'*}; DBPW=${SPLIT#*$'\n'}; unset SPLIT
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || { echo "align refused: target guard failed"; exit 3; }
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
unset DBPW PW
bytes=$(wc -c < "$OUT" | tr -d ' ')
[ "${st[0]}" -eq 0 ] || { echo "FAIL align [A01]: the SQL producer failed; $bytes bytes withheld"; exit 1; }
if [ "${st[1]}" -ne 0 ]; then
  code=A00; grep -qF 'quiz-lifecycle align: expected exactly 1 learner row' "$OUT" && code=A02
  grep -qF 'quiz-lifecycle align: e2e.password is empty' "$OUT" && code=A03
  echo "FAIL align [$code]: psql exit ${st[1]}; $bytes bytes withheld"; exit 1
fi
grep -qF 'NOTICE:  quiz-lifecycle align: 1 learner row aligned' "$OUT" || { echo "FAIL align [A04]: no completion notice; $bytes bytes withheld"; exit 1; }
echo "PASS align: exactly 1 learner row aligned to the shared auth-fixtures rule set"
