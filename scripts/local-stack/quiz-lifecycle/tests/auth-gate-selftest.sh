#!/usr/bin/env bash
# ABOUTME: LOCAL-SHIM selftest of auth-gate.sh: real disposable PostgreSQL (scratch DB with supabase-shim.sql and one
# ABOUTME: synthetic learner row) for the state/align SQL, plus a loopback GoTrue STUB for control flow. Never CI acceptance.
# Usage: auth-gate-selftest.sh <canonical maintenance URI on 127.0.0.1 or localhost, database "postgres" (same form as sql-selftest.sh)>
# Cases: OLD pass (no candidate), justified OLD rejection then candidate pass, both rejected (blocked), redirect and wrong
# user id (diagnosis-only: blocked, never aligned), refusal on a non-loopback API. Each case asserts the verdict line, the exit status, which phases ran, and that no stub secret, body
# text, user id or password reached the output. Scratch DB: unique name, created fresh, always dropped (only that one).
set -u
umask 077
BASE="${1:-}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
refuse() { echo "REFUSED $*"; exit 2; }
SCRATCH="qlc_gate_$$_$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
M=$(printf '%s' "$BASE" | node "$HERE/local-dsn.mjs" derive postgres 2>/dev/null) || refuse "maintenance DSN is not a canonical strict local URI"
S=$(printf '%s' "$BASE" | node "$HERE/local-dsn.mjs" derive "$SCRATCH" 2>/dev/null) || refuse "scratch DSN could not be derived"
M_CONN=${M%%$'\n'*}; S_CONN=${S%%$'\n'*}; export PGPASSWORD; PGPASSWORD=${M#*$'\n'}; unset M S
S_URI="$S_CONN"
[ -n "$PGPASSWORD" ] && S_URI=$(node -e 'const u=new URL(process.argv[1]); u.password=encodeURIComponent(process.env.PGPASSWORD); console.log(u.toString())' "$S_CONN")
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql -X "$@"; }
CREATED=0; STUB=
cleanup() {
  [ -n "$STUB" ] && kill "$STUB" 2>/dev/null
  if [ "$CREATED" = 1 ]; then printf 'drop database if exists :"s";\n' | psql "$M_CONN" -q -v s="$SCRATCH" -f - >/dev/null 2>&1 && echo "cleanup: dropped the scratch database this run created" || { echo "FAIL cleanup"; exit 1; }; fi
}
trap cleanup EXIT
printf 'create database :"s";\n' | psql "$M_CONN" -q -v ON_ERROR_STOP=1 -v s="$SCRATCH" -f - >/dev/null 2>&1 || refuse "could not create the scratch database"
CREATED=1
psql "$S_CONN" -q -v ON_ERROR_STOP=1 -f "$ROOT/scripts/local-db/supabase-shim.sql" >/dev/null 2>&1 || { echo "FAIL shim"; exit 1; }

PW="selftest-pw-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
PORT=$((40000 + RANDOM % 20000)); APP=$((PORT + 1))
fails=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi; }
# A learner row with the NULL shape under test (token columns unset to NULL explicitly; the shim's defaults are '').
reset_row() {
  psql "$S_CONN" -q -v ON_ERROR_STOP=1 -c "delete from auth.users" -c "insert into auth.users(id,email,encrypted_password,email_confirmed_at,email_change_token_current,phone_change,phone_change_token,reauthentication_token,created_at,updated_at) values ('9c000000-0000-4000-8000-0000000000a1','qlc-learner@insightscollective.local','x',now(),null,null,null,null,null,null)" >/dev/null
}
run_case() { # <name> <stub script> <expected exit> <expected verdict> [api override]
  reset_row
  node "$HERE/tests/auth-gate-stub.mjs" "$PORT" "$2" & STUB=$!
  for _ in $(seq 50); do (exec 3<>/dev/tcp/127.0.0.1/$PORT) 2>/dev/null && break; sleep 0.1; done
  out=$(env -i PATH="$PATH" HOME="$HOME" VITE_SUPABASE_URL="${5:-http://127.0.0.1:$PORT}" E2E_BASE_URL="http://127.0.0.1:$APP" \
    VITE_SUPABASE_ANON_KEY=stub-anon-key-000000000000 E2E_TEST_PASSWORD="$PW" SUPABASE_DB_URL="$S_URI" E2E_RELAY_TARGET="http://127.0.0.1:$PORT" \
    "$HERE/auth-gate.sh" 2>&1); rc=$?
  kill "$STUB" 2>/dev/null; wait "$STUB" 2>/dev/null; STUB=
  XRC="$3"; XV="$4"
  check "$1: exit $3" '[ "$rc" = "$XRC" ]'
  check "$1: verdict" 'printf "%s\n" "$out" | tail -n 1 | grep -qxF "$XV"'
  check "$1: no secret, body text, user id or password in output" '! printf "%s" "$out" | grep -qE "SECRETTOKEN|BODYTEXT|9c000000|$PW|stub-anon-key"'
  LAST="$out"
}
run_case old-pass 200 0 "auth-gate old=pass candidate=not-applied justification=na seed_causality=not-claimed ui=run"
check "old-pass: candidate never ran" '! printf "%s" "$LAST" | grep -q "phase=candidate\|align"'
check "old-pass: old-seed state shows the NULL shape" 'printf "%s" "$LAST" | grep -q "auth-state user_row=true .*phone_change_null=true .* phase=old-seed"'
check "old-pass: health version token" 'printf "%s" "$LAST" | grep -qx "gotrue-health method=GET path=/auth/v1/health status=200 version=v2.999.0"'
run_case old-fail-candidate-pass 400,200 0 "auth-gate old=auth-rejected candidate=pass justification=null-columns seed_causality=consistent-not-proven ui=run"
check "candidate: old probe line" 'printf "%s" "$LAST" | grep -qx "auth-probe method=POST path=/auth/v1/token grant=password status=400 error_code=invalid_credentials uid_present=false uid_match=false class=auth-rejected phase=old-seed"'
check "candidate: align applied to exactly one row" 'printf "%s" "$LAST" | grep -qx "PASS align: exactly 1 learner row aligned to the shared auth-fixtures rule set"'
check "candidate: state after align has no NULL token/timestamp column" 'printf "%s" "$LAST" | grep "phase=candidate" | grep "^auth-state" | grep -q "created_at_null=false updated_at_null=false confirmation_token_null=false recovery_token_null=false email_change_token_new_null=false email_change_null=false email_change_token_current_null=false phone_change_null=false phone_change_token_null=false reauthentication_token_null=false"'
run_case both-fail 400,400 1 "auth-gate old=auth-rejected candidate=fail justification=null-columns seed_causality=not-supported ui=blocked"
run_case redirect 302 1 "auth-gate old=diagnosis-only candidate=not-applied justification=na seed_causality=not-claimed ui=blocked"
check "redirect: no alignment (no password rewrite)" '! printf "%s" "$LAST" | grep -q "align"'
check "redirect: classified" 'printf "%s" "$LAST" | grep -q "status=302 error_code=redirect"'
run_case wrong-user 200w,200w 1 "auth-gate old=diagnosis-only candidate=not-applied justification=na seed_causality=not-claimed ui=blocked"
check "wrong-user: no alignment (no password rewrite)" '! printf "%s" "$LAST" | grep -q "align"'
check "wrong-user: uid present but no match" 'printf "%s" "$LAST" | grep -q "status=200 error_code=none uid_present=true uid_match=false class=diagnosis-only phase=old-seed"'
run_case non-loopback-api 200 2 "auth-gate old=health-failed candidate=not-applied justification=na seed_causality=not-claimed ui=blocked" "http://example.com:80"
psql "$S_CONN" -At -c "select count(*) from auth.users" | grep -qx 1 && echo "ok   scratch holds exactly the one synthetic row" || { echo "FAIL row count"; fails=$((fails + 1)); }
[ "$fails" -eq 0 ] && echo "PASS auth-gate selftest (LOCAL-SHIM + stub GoTrue; control flow only)" || { echo "FAIL auth-gate selftest: $fails"; exit 1; }
