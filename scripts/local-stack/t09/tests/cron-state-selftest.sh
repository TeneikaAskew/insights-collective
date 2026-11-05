#!/usr/bin/env bash
# ABOUTME: Executes the pg_cron block of egress-verify.sql (extracted verbatim) on a scratch LOCAL PostgreSQL database
# ABOUTME: across every accepted and refused state. Preload states are MOCKED by shadowing current_setting(); labelled so.
# Usage: cron-state-selftest.sh <maintenance URI>: scheme postgresql, a user (optional password), a loopback host (127.0.0.1, localhost or ::1), a port, and the path /postgres
# The URI must be EXACTLY that canonical form (no query, fragment, keyword/value DSN, other database or trailing slash).
# It is checked before ANY psql call; the scratch DSN is rebuilt from the parsed parts, checked the same way, and the
# server must report the scratch database as current_database() before any mock object is created.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
URL="${1:-}"
CANON='^postgresql://([A-Za-z0-9_.-]+(:[^@/?#[:space:]]*)?)@(127\.0\.0\.1|localhost|\[::1\]):([0-9]{1,5})/([a-z0-9_]+)$'
[[ "$URL" =~ $CANON ]] && [ "${BASH_REMATCH[5]}" = postgres ] || { echo "refused: maintenance URI is not the canonical loopback /postgres form (nothing was run)"; exit 2; }
AUTH="${BASH_REMATCH[1]}"; HOSTP="${BASH_REMATCH[3]}"; PORT="${BASH_REMATCH[4]}"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$URL" >/dev/null 2>&1 || { echo "refused: not loopback (nothing was run)"; exit 2; }
DB=t09_cron_$$
SCRATCH="postgresql://$AUTH@$HOSTP:$PORT/$DB"
[[ "$SCRATCH" =~ $CANON ]] && [ "${BASH_REMATCH[5]}" = "$DB" ] || { echo "refused: derived scratch DSN is not canonical (nothing was run)"; exit 2; }
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE -u PGDATABASE -u PGOPTIONS psql "$@"; }
psql -X -q "$URL" -c "create database $DB" || exit 2
trap 'psql -X -q "$URL" -c "drop database if exists $DB" >/dev/null' EXIT
got=$(psql -X -Atq "$SCRATCH" -c "select current_database()") || exit 2
[ "$got" = "$DB" ] || { echo "refused: scratch connection reached '$got', not $DB"; exit 2; }
echo "target: scratch database $DB (server-confirmed current_database)"
BLOCK=$(awk '/^  -- pg_cron\. Exactly one of three states/{on=1} /^  raise notice .egress-verify OK \[app\]/{on=0} on' "$HERE/egress-verify.sql")
[ -n "$BLOCK" ] || { echo "FAIL: pg_cron block not found in egress-verify.sql"; exit 1; }
DOBLK="do \$t\$ declare n int; cron_state text; preload text; preloaded boolean; cron_db text; launchers bigint; lib text; begin
$BLOCK
raise notice 'CRON-STATE %', cron_state; end \$t\$;"
# MOCK: t09mock.current_setting shadows pg_catalog's only when search_path names t09mock first; real values otherwise.
psql -X -q -v ON_ERROR_STOP=1 "$SCRATCH" <<'SQL' >/dev/null
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
  local out st; out=$(psql -X -q "$SCRATCH" -v ON_ERROR_STOP=1 -c "begin" -c "select set_config('t09.allow_shim','0',true)" -c "$2" -c "$DOBLK" -c "rollback" 2>&1); st=$?
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
case_ G1-quoted-pg_cron-is-preloaded-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','pg_stat_statements, \"pg_cron\"'),('cron.database_name','$DB')" PASS "pg_cron in shared_preload_libraries, cron.database_name=$DB"
case_ G2-tab-prefixed-pg_cron-is-preloaded-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries',E'pg_stat_statements,\tpg_cron'),('cron.database_name','$DB')" PASS "pg_cron in shared_preload_libraries, cron.database_name=$DB"
case_ G3-upper-bare-folds-to-pg_cron-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','PG_CRON'),('cron.database_name','$DB')" PASS "pg_cron in shared_preload_libraries"
case_ G4-quoted-pg_cron-unknown-db-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','\"pg_cron\"'),('cron.database_name',null)" FAIL "cron.database_name is unreadable"
case_ G5-tab-pg_cron-other-db-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries',E'\tpg_cron'),('cron.database_name','postgres')" FAIL "cron.database_name is postgres, not this database"
case_ N1-libdir-path-fails-closed-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','\$libdir/pg_cron')" FAIL "not a canonical library name; pg_cron preload state UNKNOWN"
case_ N2-so-suffix-fails-closed-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','pg_cron.so')" FAIL "preload state UNKNOWN"
case_ N3-empty-entry-fails-closed-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','pg_net,,pg_stat_statements')" FAIL "preload state UNKNOWN"
case_ N4-unbalanced-quote-fails-closed-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','\"pg_cron')" FAIL "preload state UNKNOWN"
case_ N5-quoted-with-comma-fails-closed-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','\"pg_cron,x\"')" FAIL "preload state UNKNOWN"
case_ N6-not-preloaded-but-db-empty-string-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','pg_stat_statements'),('cron.database_name','')" FAIL "cron.database_name is , not this database"
case_ A4-empty-preload-not-preloaded-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','')" PASS "pg_cron not in shared_preload_libraries, cron.database_name=unset"
case_ A5-similar-name-is-not-pg_cron-MOCKED "$M insert into t09mock.gucs values ('shared_preload_libraries','pg_cronx, pg_net')" PASS "pg_cron not in shared_preload_libraries"
case_ A3-shim-standin-zero-jobs-REAL "select set_config('t09.allow_shim','1',true); create schema net; create function net._t09_local_shim_marker() returns void language sql as 'select'; create schema cron; create table cron.job(jobid int)" PASS "CRON-STATE LOCAL-SHIM, 0 jobs"
case_ R6-shim-standin-one-job-REAL "select set_config('t09.allow_shim','1',true); create schema net; create function net._t09_local_shim_marker() returns void language sql as 'select'; create schema cron; create table cron.job(jobid int); insert into cron.job values (1)" FAIL "cron.job has 1 job"
case_ R7-shim-marker-without-allow-REAL "create schema net; create function net._t09_local_shim_marker() returns void language sql as 'select'; create schema cron; create table cron.job(jobid int)" FAIL "a cron schema exists"
echo "== cron-state selftest (LOCAL PostgreSQL; preload states MOCKED): $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
