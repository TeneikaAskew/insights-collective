#!/usr/bin/env bash
# ABOUTME: LOCAL-SHIM self-test of the fixture against the schema snapshot on a disposable plain PostgreSQL: the fixture
# ABOUTME: applies, the learner can read every scenario's questions, start_quiz_attempt enforces 1/2/NULL/0, the ledger is read-only.
# Usage: sql-selftest.sh <loopback maintenance url> <template db built by scripts/local-db/build-from-snapshot.sh>
# LOCAL-SHIM: plain PostgreSQL with scripts/local-db/supabase-shim.sql, NOT a Supabase stack: no GoTrue, PostgREST,
# Kong or edge runtime, and RLS is exercised only through SET ROLE + request.jwt.claims. Never CI acceptance.
# DISPOSABLE ONLY: drops and recreates the database qlc_selftest.
set -u
BASE="${1:?maintenance url}"; TEMPLATE="${2:?template db}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$BASE" >/dev/null || { echo "FAIL not a loopback DSN"; exit 2; }
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql -X "$@"; }
DB="${BASE%/*}/qlc_selftest"; LEARNER=9c000000-0000-4000-8000-0000000000a1
pass=0; fail=0
ok()  { echo "PASS $*"; pass=$((pass + 1)); }
bad() { echo "FAIL $*"; fail=$((fail + 1)); }
psql "$BASE" -qc "drop database if exists qlc_selftest" -qc "create database qlc_selftest template $TEMPLATE" >/dev/null 2>&1 \
  || { echo "FAIL clone"; exit 1; }
export E2E_TEST_PASSWORD="local-shim-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"

"$HERE/fixture.sh" --no-target-guard "$DB" >/dev/null && ok "fixture applies" || bad "fixture applies"
out=$("$HERE/fixture.sh" --no-target-guard "$DB" 2>&1); [ $? -eq 0 ] && ok "fixture re-run on an unused stack is idempotent" || bad "fixture re-run: $out"

# as_learner <sql>: one transaction as the learner, through the same role and claims PostgREST would set.
as_learner() {
  psql "$DB" -Atq -v ON_ERROR_STOP=1 -c "begin; set local role authenticated;
    select set_config('request.jwt.claims', '{\"sub\":\"$LEARNER\",\"role\":\"authenticated\"}', true);
    $1; commit;" 2>&1 | tail -n +2
}
q() { printf '9c00%s02-0000-4000-8000-000000000000' "$1"; }

n=$(as_learner "select count(*) from public.get_quiz_questions_for_taking('$(q 10)')"); [ "$n" = 2 ] && ok "learner reads F1 questions (2)" || bad "learner reads F1 questions: $n"
leak=$(as_learner "select count(*) from public.get_quiz_questions_for_taking('$(q 10)') g where g::text like '%\"correct\"%'")
[ "$leak" = 0 ] && ok "taking RPC returns no correct flag" || bad "taking RPC leaks correct flags: $leak"

a=$(as_learner "select attempt from public.start_quiz_attempt('$(q 10)')"); [ "$a" = 1 ] && ok "F1 start -> attempt 1" || bad "F1 start: $a"
e=$(as_learner "select attempt from public.start_quiz_attempt('$(q 10)')"); grep -q "used all 1 attempts" <<<"$e" && ok "F1 second start refused (limit 1)" || bad "F1 second start not refused: $e"
for s in 1 2; do as_learner "select attempt from public.start_quiz_attempt('$(q 12)')" >/dev/null; done
e=$(as_learner "select attempt from public.start_quiz_attempt('$(q 12)')"); grep -q "used all 2 attempts" <<<"$e" && ok "F3 third start refused (limit 2)" || bad "F3 third start: $e"
for nn in 13 14; do
  for s in 1 2; do as_learner "select attempt from public.start_quiz_attempt('$(q $nn)')" >/dev/null; done
  a=$(as_learner "select attempt from public.start_quiz_attempt('$(q $nn)')"); [ "$a" = 3 ] && ok "quiz $nn third start allowed (unlimited)" || bad "quiz $nn third start: $a"
done
d=$(as_learner "insert into public.quiz_submissions (quiz_id, user_id, attempt) values ('$(q 19)', '$LEARNER', 1) returning attempt")
grep -qiE "permission denied|row-level security" <<<"$d" && ok "direct INSERT refused for the learner" || bad "direct INSERT not refused: $d"

n=$(psql "$DB" -At -F $'\t' -v quiz="$(q 13)" -f "$HERE/ledger.sql" | grep -c '^A')
[ "$n" = 3 ] && ok "ledger lists 3 attempts for quiz 13" || bad "ledger attempts: $n"
w=$(psql "$DB" -At -v quiz="$(q 13)" -c "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY" -c "delete from public.quiz_submissions" 2>&1)
grep -q "read-only transaction" <<<"$w" && ok "ledger session refuses writes" || bad "ledger session is writable: $w"

e=$("$HERE/fixture.sh" --no-target-guard "$DB" 2>&1); [ $? -ne 0 ] && grep -q "already holds attempts" <<<"$e" && ok "fixture refuses a used stack" || bad "fixture on a used stack: $e"
E2E_TEST_PASSWORD= "$HERE/fixture.sh" --no-target-guard "$DB" >/dev/null 2>&1; [ $? -eq 2 ] && ok "fixture refuses an empty password" || bad "fixture accepted an empty password"
"$HERE/fixture.sh" --no-target-guard "postgresql://postgres@db.example.com:5432/postgres" >/dev/null 2>&1; [ $? -eq 2 ] && ok "fixture refuses a non-loopback DSN" || bad "fixture accepted a non-loopback DSN"

psql "$BASE" -qc "drop database if exists qlc_selftest" >/dev/null 2>&1
echo "== LOCAL-SHIM sql-selftest: $pass passed, $fail failed (plain PostgreSQL + shim; not a Supabase stack, not CI acceptance)"
[ "$fail" -eq 0 ]
