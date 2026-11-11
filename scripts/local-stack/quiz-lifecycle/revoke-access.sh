#!/usr/bin/env bash
# ABOUTME: T-62 only: removes the synthetic learner's enrollment in ONE synthetic T-62 course (20, 22 or 24), so the
# ABOUTME: real can_access_quiz predicate denies start_quiz_attempt. Same guards and secret channel as fixture.sh.
# Usage: revoke-access.sh <20|22|24> [--no-target-guard]   (DSN from SUPABASE_DB_URL only, never an argument)
# Writes exactly one row of synthetic data (public.enrollments, learner 9c000000-…-a1, course 9c00GG00-…-c0 whose title
# starts "QLC T62 refusal "), refuses unless exactly one row is removed, and prints only fixed lines. No RLS, policy,
# attempt, scoring or completion change. The DB password reaches psql only through its process environment.
set -u
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
GG="${1:-}"; GUARD=1
case "$GG" in 20|22|24) ;; *) echo "revoke refused: scenario must be 20, 22 or 24"; exit 2 ;; esac
[ $# -le 2 ] || { echo "revoke refused: unexpected argument"; exit 2; }
if [ "${2:-}" = "--no-target-guard" ]; then GUARD=0; elif [ -n "${2:-}" ]; then echo "revoke refused: unexpected argument"; exit 2; fi
DB="${SUPABASE_DB_URL:-}"
[ -n "$DB" ] || { echo "revoke refused: no database URL"; exit 2; }
SPLIT=$(printf '%s' "$DB" | node "$HERE/local-dsn.mjs" split 2>/dev/null) || { echo "revoke refused: not a strict local DSN"; exit 2; }
CONN=${SPLIT%%$'\n'*}; DBPW=${SPLIT#*$'\n'}; unset SPLIT
if [ "$GUARD" = 1 ]; then
  node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || { echo "revoke refused: target guard failed"; exit 3; }
fi
OUT=$(mktemp); trap 'rm -f "$OUT"' EXIT
printf '%s\n' "DO \$\$
DECLARE v_n int;
BEGIN
  DELETE FROM public.enrollments e
   USING public.courses c
   WHERE e.course_id = c.id
     AND e.user_id = '9c000000-0000-4000-8000-0000000000a1'
     AND c.id = '9c00${GG}00-0000-4000-8000-0000000000c0'
     AND c.title LIKE 'QLC T62 refusal %';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'quiz-lifecycle revoke: expected exactly one synthetic enrollment, found %', v_n; END IF;
  RAISE NOTICE 'quiz-lifecycle revoke: one synthetic enrollment removed';
END \$\$;" | (
  unset PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGPORT PGPASSFILE
  export PGPASSWORD="$DBPW"
  exec psql "$CONN" -X -q -v ON_ERROR_STOP=1 -f - >"$OUT" 2>&1
)
st=("${PIPESTATUS[@]}")
unset DBPW
bytes=$(wc -c < "$OUT" | tr -d ' ')
[ "${st[0]}" -eq 0 ] || { echo "FAIL revoke [P01]: producer failed; $bytes bytes withheld"; exit 1; }
if [ "${st[1]}" -ne 0 ]; then
  if grep -qF 'ERROR:  quiz-lifecycle revoke: expected exactly one synthetic enrollment' "$OUT"; then
    echo "FAIL revoke [V01]: not exactly one synthetic enrollment for course $GG ($bytes bytes withheld)"
  else
    echo "FAIL revoke [V00]: psql failed ($bytes bytes withheld)"
  fi
  exit 1
fi
grep -qF 'NOTICE:  quiz-lifecycle revoke: one synthetic enrollment removed' "$OUT" \
  || { echo "FAIL revoke [V02]: no completion notice ($bytes bytes withheld)"; exit 1; }
echo "PASS revoke: course $GG enrollment removed (synthetic)"
