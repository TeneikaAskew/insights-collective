#!/usr/bin/env bash
# ABOUTME: Executes the pg_cron block of egress-verify.sql (extracted verbatim) on a scratch LOCAL PostgreSQL database
# ABOUTME: across every accepted and refused state. Preload states are MOCKED by shadowing current_setting(); labelled so.
# Usage: cron-state-selftest.sh <loopback maintenance url ending in /postgres>
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
URL="${1:?url}"; node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$URL" >/dev/null || { echo "refused: not loopback"; exit 2; }
DB=t09_cron_$$; BASE="${URL%/*}"
psql -X -q "$URL" -c "create database $DB" || exit 2
trap 'psql -X -q "$URL" -c "drop database if exists $DB" >/dev/null' EXIT
BLOCK=$(awk '/^  -- pg_cron\. Exactly one of three states/{on=1} /^  raise notice .egress-verify OK \[app\]/{on=0} on' "$HERE/egress-verify.sql")
[ -n "$BLOCK" ] || { echo "FAIL: pg_cron block not found in egress-verify.sql"; exit 1; }
DOBLK="do \$t\$ declare n int; cron_state text; preload text; preloaded boolean; cron_db text; launchers bigint; begin
$BLOCK
raise notice 'CRON-STATE %', cron_state; end \$t\$;"
# MOCK: t09mock.current_setting shadows pg_catalog's only when search_path names t09mock first; real values otherwise.
psql -X -q -v ON_ERROR_STOP=1 "$BASE/$DB" <<'SQL' >/dev/null
create schema t09mock; create table t09mock.gucs(name text primary key, value text);
create function t09mock.current_setting(text) returns text language sql as
  $$ select coalesce((select value from t09mock.gucs where name = $1), pg_catalog.current_setting($1)) $$;
create function t09mock.current_setting(text, boolean) returns text language sql as
  $$ select case when exists (select 1 from t09mock.gucs where name = $1) then (select value from t09mock.gucs where name = $1)
                 else pg_catalog.current_setting($1, $2) end $$;
select set_config('t09.allow_shim', '0', false);
SQL
pass=0; fail=0
case_() { # label, setup sql, expect(PASS|FAIL), pattern
  local out st; out=$(psql -X -q "$BASE/$DB" -v ON_ERROR_STOP=1 -c "begin" -c "select set_config('t09.allow_shim','0',true)" -c "$2" -c "$DOBLK" -c "rollback" 2>&1); st=$?
  local got=PASS; [ $st -eq 0 ] || got=FAIL
  if [ "$got" = "$3" ] && grep -qE "$4" <<<"$out"; then echo "PASS $1 -> $got :: $(grep -oE "$4.*" <<<"$out" | head -1 | cut -c1-200)"; pass=$((pass+1))
  else echo "FAIL $1 expected $3 /$4/, got $got: $(tr '\n' ' ' <<<"$out" | cut -c1-300)"; fail=$((fail+1)); fi
}
M="set local search_path = t09mock, pg_catalog, public;"
case_ A1-absent-not-preloaded-REAL "select 1" PASS "ABSENT in target db $DB .*pg_cron not in shared_preload_libraries, cron.database_name=unset, launcher backends 0; no pg_cron job can be scheduled from this database; other databases and any cluster-wide scheduler NOT claimed"
case_ R1-cron-schema-without-extension-REAL "create schema cron" FAIL "a cron schema exists in this database"
case_ R2-cron-job-table-without-extension-REAL "create schema cron; create table cron.job(jobid int)" FAIL "a cron schema exists"
case_ A2-preloaded-target-db-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','pg_stat_statements, pg_cron, pg_net'),('cron.database_name','$DB')" PASS "pg_cron in shared_preload_libraries, cron.database_name=$DB, launcher backends 0"
case_ R3-preloaded-other-db-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','pg_cron'),('cron.database_name','postgres')" FAIL "cron.database_name is postgres, not this database"
case_ R4-preloaded-db-unreadable-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','pg_cron'),('cron.database_name',null)" FAIL "cron.database_name is unreadable"
case_ R3b-config-set-other-db-not-preloaded-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','pg_stat_statements'),('cron.database_name','postgres')" FAIL "cron.database_name is postgres, not this database"
case_ R5-preload-probe-fails-MOCKED "$M create or replace function t09mock.current_setting(text) returns text language plpgsql as \$f\$ begin raise exception 'probe failed'; end \$f\$" FAIL "probe failed"
case_ A3-shim-standin-zero-jobs-REAL "select set_config('t09.allow_shim','1',true); create schema net; create function net._t09_local_shim_marker() returns void language sql as 'select'; create schema cron; create table cron.job(jobid int)" PASS "CRON-STATE LOCAL-SHIM, 0 jobs"
case_ R6-shim-standin-one-job-REAL "select set_config('t09.allow_shim','1',true); create schema net; create function net._t09_local_shim_marker() returns void language sql as 'select'; create schema cron; create table cron.job(jobid int); insert into cron.job values (1)" FAIL "cron.job has 1 job"
case_ R7-shim-marker-without-allow-REAL "create schema net; create function net._t09_local_shim_marker() returns void language sql as 'select'; create schema cron; create table cron.job(jobid int)" FAIL "a cron schema exists"
echo "== cron-state selftest (LOCAL PostgreSQL; preload states MOCKED): $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
