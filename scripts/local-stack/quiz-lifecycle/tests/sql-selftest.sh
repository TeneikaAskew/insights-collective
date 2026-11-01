#!/usr/bin/env bash
# ABOUTME: LOCAL-SHIM self-test of the fixture against the schema snapshot on a disposable plain PostgreSQL, in a scratch
# ABOUTME: database it creates fresh under a unique name, never adopts, and always drops (only that one) on exit.
# Usage: sql-selftest.sh <canonical maintenance URI: postgresql://user[:pw]@127.0.0.1|localhost:<port>/postgres> <template db>
# LOCAL-SHIM: plain PostgreSQL + scripts/local-db/supabase-shim.sql, NOT a Supabase stack (no GoTrue, PostgREST, Kong or
# edge runtime; RLS exercised only through SET ROLE + request.jwt.claims). Never CI acceptance.
#
# Isolation: BASE must be a canonical maintenance URI (strict local DSN, URI form, database "postgres", no query); the
# scratch URI is derived by local-dsn.mjs, never by string slicing. TEMPLATE must be a plain lower-case identifier and is
# passed to SQL only as a psql :"identifier" variable. The scratch name is unique per run (pid + 128-bit random); if it
# already exists the run refuses and touches nothing. Every refusal happens before the first psql call.
set -u
umask 077
BASE="${1:-}"; TEMPLATE="${2:-}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
refuse() { echo "REFUSED $*"; exit 2; }
[[ "$TEMPLATE" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || refuse "template is not a plain lower-case identifier"
SCRATCH="qlc_selftest_$$_$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
SCRATCH="${SCRATCH:0:63}"
[[ "$SCRATCH" =~ ^qlc_selftest_[0-9]+_[0-9a-f]+$ ]] || refuse "could not derive a scratch name"
M=$(printf '%s' "$BASE" | node "$HERE/local-dsn.mjs" derive postgres 2>/dev/null) || refuse "maintenance DSN is not a canonical strict local URI"
S=$(printf '%s' "$BASE" | node "$HERE/local-dsn.mjs" derive "$SCRATCH" 2>/dev/null) || refuse "scratch DSN could not be derived"
M_CONN=${M%%$'\n'*}; S_CONN=${S%%$'\n'*}; export PGPASSWORD; PGPASSWORD=${M#*$'\n'}; unset M S
# The scratch URI handed to fixture.sh carries the same credentials, rebuilt by the same helper.
S_URI_WITH_PW="$S_CONN"
if [ -n "$PGPASSWORD" ]; then
  S_URI_WITH_PW=$(node -e 'const u=new URL(process.argv[1]); u.password=encodeURIComponent(process.env.PGPASSWORD); console.log(u.toString())' "$S_CONN")
fi
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql -X "$@"; }
# msql <sql>: one statement on the maintenance DB with :'scratch' / :"scratch" / :"tpl" variables, via stdin.
msql() { printf '%s\n' "$1" | psql "$M_CONN" -Atq -v ON_ERROR_STOP=1 -v scratch="$SCRATCH" -v tpl="$TEMPLATE" -f - 2>/dev/null; }

CREATED=0
cleanup() {
  if [ "$CREATED" = 1 ]; then
    if msql 'drop database if exists :"scratch";' >/dev/null; then echo "cleanup: dropped the scratch database this run created"
    else echo "FAIL cleanup: could not drop the scratch database this run created"; exit 1; fi
  fi
}
trap cleanup EXIT

exists=$(msql "select count(*) from pg_database where datname = :'scratch';") || { echo "FAIL maintenance query"; exit 1; }
[ "$exists" = 0 ] || refuse "scratch database name already exists; not adopting it"
tpl=$(msql "select count(*) from pg_database where datname = :'tpl';") || { echo "FAIL maintenance query"; exit 1; }
[ "$tpl" = 1 ] || refuse "template database does not exist"
msql 'create database :"scratch" template :"tpl";' >/dev/null || { echo "FAIL create scratch database"; exit 1; }
CREATED=1

LEARNER=9c000000-0000-4000-8000-0000000000a1
export E2E_TEST_PASSWORD="local-shim-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
pass=0; fail=0
ok()  { echo "PASS $*"; pass=$((pass + 1)); }
bad() { echo "FAIL $*"; fail=$((fail + 1)); }

SUPABASE_DB_URL="$S_URI_WITH_PW" "$HERE/fixture.sh" --no-target-guard >/dev/null && ok "fixture applies (16 quizzes)" || bad "fixture applies"
# Re-run under strace with the REAL psql: every execve of the child chain is traced. If the maintenance URI carries no
# password (trust auth), a synthetic one is used for this run only, so the DB-password path is exercised too.
TRACE_PW="$PGPASSWORD"; [ -n "$TRACE_PW" ] || TRACE_PW="shimdb$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
TRACE_URI=$(PGPASSWORD="$TRACE_PW" node -e 'const u=new URL(process.argv[1]); u.password=encodeURIComponent(process.env.PGPASSWORD); console.log(u.toString())' "$S_CONN")
TR=$(mktemp); out=$(SUPABASE_DB_URL="$TRACE_URI" strace -f -qq -e trace=execve -s 65535 -o "$TR" "$HERE/fixture.sh" --no-target-guard 2>&1); st=$?
[ "$st" -eq 0 ] && ok "fixture re-run on an unused stack is idempotent (real psql, traced)" || bad "fixture re-run: $out"
grep -q 'execve("[^"]*psql' "$TR" && ! grep -qF "$TRACE_PW" "$TR" && ! grep -qF "$E2E_TEST_PASSWORD" "$TR" \
  && ok "real child chain: $(grep -c 'execve(' "$TR") execve calls, no DB or learner password in any argv" || bad "real child chain: password in an argv or psql not traced"
rm -f "$TR"; unset TRACE_PW TRACE_URI

# as_learner <sql>: one transaction as the learner, through the role and claims PostgREST would set.
as_learner() {
  printf '%s\n' "begin; set local role authenticated;
    select set_config('request.jwt.claims', '{\"sub\":\"$LEARNER\",\"role\":\"authenticated\"}', true) is not null as c \\gset
    $1; commit;" | psql "$S_CONN" -Atq -v ON_ERROR_STOP=1 -f - 2>&1
}
q() { printf '9c00%s02-0000-4000-8000-000000000000' "$1"; }

n=$(psql "$S_CONN" -Atq -c "select count(*) from public.quizzes where id::text like '9c00%'"); [ "$n" = 16 ] && ok "16 scenario quizzes" || bad "scenario quizzes: $n"
n=$(as_learner "select count(*) from public.get_quiz_questions_for_taking('$(q 10)')"); [ "$n" = 2 ] && ok "learner reads F1 questions (2)" || bad "learner reads F1 questions: $n"
leak=$(as_learner "select count(*) from public.get_quiz_questions_for_taking('$(q 10)') g where g::text like '%\"correct\"%'")
[ "$leak" = 0 ] && ok "taking RPC returns no correct flag" || bad "taking RPC leaks correct flags: $leak"
a=$(as_learner "select attempt from public.start_quiz_attempt('$(q 10)')"); [ "$a" = 1 ] && ok "F1 start -> attempt 1" || bad "F1 start: $a"
e=$(as_learner "select attempt from public.start_quiz_attempt('$(q 10)')"); grep -q "used all 1 attempts" <<<"$e" && ok "F1 second start refused (limit 1)" || bad "F1 second start not refused"
for s in 1 2; do as_learner "select attempt from public.start_quiz_attempt('$(q 12)')" >/dev/null; done
e=$(as_learner "select attempt from public.start_quiz_attempt('$(q 12)')"); grep -q "used all 2 attempts" <<<"$e" && ok "F3 third start refused (limit 2)" || bad "F3 third start not refused"
for nn in 13 14; do
  for s in 1 2; do as_learner "select attempt from public.start_quiz_attempt('$(q $nn)')" >/dev/null; done
  a=$(as_learner "select attempt from public.start_quiz_attempt('$(q $nn)')"); [ "$a" = 3 ] && ok "quiz $nn third start allowed (unlimited)" || bad "quiz $nn third start: $a"
done
d=$(as_learner "insert into public.quiz_submissions (quiz_id, user_id, attempt) values ('$(q 19)', '$LEARNER', 1) returning attempt")
grep -qiE "permission denied|row-level security" <<<"$d" && ok "direct INSERT refused for the learner" || bad "direct INSERT not refused"

n=$(psql "$S_CONN" -At -F $'\t' -v quiz="$(q 13)" -f "$HERE/ledger.sql" | grep -c '^A')
[ "$n" = 3 ] && ok "ledger lists 3 attempts for quiz 13" || bad "ledger attempts: $n"
w=$(printf '%s\n' "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;" "delete from public.quiz_submissions;" | psql "$S_CONN" -At -f - 2>&1)
grep -q "read-only transaction" <<<"$w" && ok "ledger session refuses writes" || bad "ledger session is writable"

e=$(SUPABASE_DB_URL="$S_URI_WITH_PW" "$HERE/fixture.sh" --no-target-guard 2>&1); [ $? -ne 0 ] && grep -q "already holds attempts" <<<"$e" && ok "fixture refuses a used stack" || bad "fixture on a used stack: $e"
E2E_TEST_PASSWORD= SUPABASE_DB_URL="$S_URI_WITH_PW" "$HERE/fixture.sh" --no-target-guard >/dev/null 2>&1; [ $? -eq 2 ] && ok "fixture refuses an empty password" || bad "fixture accepted an empty password"

echo "== LOCAL-SHIM sql-selftest: $pass passed, $fail failed (plain PostgreSQL + shim; not a Supabase stack, not CI acceptance)"
[ "$fail" -eq 0 ]
