#!/usr/bin/env bash
# ABOUTME: LOCAL failure-injection proof for apply-atomic.sh vs the frozen `-f FILE -c ledger` order, on scratch copies of a
# ABOUTME: local template. Injections live only in the scratch DB (a trigger on the ledger, an event trigger on DDL).
# Usage: atomic-apply-selftest.sh <maintenance URI .../postgres on loopback> <template> <dir with the 7 reviewed files> <expected NEW fingerprint file>
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; URL="$1"; TPL="$2"; MIG="$3"; NEWFP="$4"
case "$URL" in postgresql://*@127.0.0.1:*/postgres) ;; *) echo "refused: loopback maintenance URI only"; exit 2;; esac
BASE="${URL%/postgres}"; pass=0; fail=0; ok() { echo "PASS $*"; pass=$((pass+1)); }; no() { echo "FAIL $*"; fail=$((fail+1)); }
fp() { psql -X -At "$BASE/$1" -c "select p.proname||' '||md5(p.prosrc)||' '||coalesce((select string_agg(a::text,',' order by a::text) from unnest(p.proacl) a),'') from pg_proc p where p.pronamespace='public'::regnamespace order by 1" -c "select tablename||'|'||policyname||' '||md5(coalesce(qual,'')||'|'||coalesce(with_check,'')||'|'||cmd||'|'||permissive||'|'||roles::text) from pg_policies where schemaname='public' order by 1" -c "select tgrelid::regclass||' '||tgname||' '||md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'supabase_migrations.%' order by 1"; }
ledger() { psql -X -At "$BASE/$1" -c "select count(*) from supabase_migrations.schema_migrations where version = '$2'"; }
fresh() { psql -X -q "$URL" -c "drop database if exists $1" -c "create database $1 template $TPL" >/dev/null; }
drop() { psql -X -q "$URL" -c "drop database if exists $1" >/dev/null; }
INJ_LEDGER="create function inj_ledger() returns trigger language plpgsql as \$\$begin raise exception 'INJECTED failure at ledger insertion'; end\$\$; create trigger inj before insert on supabase_migrations.schema_migrations for each row execute function inj_ledger();"
inj_ddl() { # $1 object-identity substring of the file's LAST DDL, $2 raise|terminate
  local act="raise exception 'INJECTED failure after the last DDL, before the file''s COMMIT'"
  [ "$2" = terminate ] && act="perform pg_terminate_backend(pg_backend_pid())"
  echo "create function inj_ddl() returns event_trigger language plpgsql as \$\$ declare r record; begin for r in select * from pg_event_trigger_ddl_commands() loop if r.object_identity like '%$1%' then $act; end if; end loop; end \$\$; create event trigger inj_ddl on ddl_command_end execute function inj_ddl();"
}
frozen() { PGURL="$BASE/$1"; psql "$PGURL" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$2" -c "insert into supabase_migrations.schema_migrations (version) values ('$3')"; }
atomic() { PGURL="$BASE/$1" bash "$HERE/apply-atomic.sh" "$2" "$3"; }
# Single-file cases run each reviewed file from its own directory (so the order check sees no lower pending version);
# the ordered positive run and the order negative use the full directory.
SOLO=$(mktemp -d); for v in 20261101000000 20261101000100 20261101000200; do mkdir -p "$SOLO/$v"; cp "$MIG"/${v}_*.sql "$SOLO/$v/"; done
f0=$(ls "$SOLO"/20261101000000/*.sql); f1=$(ls "$SOLO"/20261101000100/*.sql); f2=$(ls "$SOLO"/20261101000200/*.sql)
case_run() { # label runner file version injectionSQL expect(rolledback|split)
  local db=atomic_st_$$ label="$1" runner="$2" file="$3" ver="$4" inj="$5" expect="$6"
  fresh $db; fp $db > /tmp/fp-pre.$$
  psql -X -q -v ON_ERROR_STOP=1 "$BASE/$db" -c "$inj" >/dev/null || { no "$label injection setup"; drop $db; return; }
  $runner $db "$file" "$ver" > /tmp/out.$$ 2>&1; local st=$?
  # remove the injection objects before fingerprinting (they are not part of the schema under test)
  psql -X -q "$BASE/$db" -c "drop event trigger if exists inj_ddl; drop function if exists inj_ddl(); drop trigger if exists inj on supabase_migrations.schema_migrations; drop function if exists inj_ledger();" >/dev/null 2>&1
  fp $db > /tmp/fp-post.$$; local same=no; diff -q /tmp/fp-pre.$$ /tmp/fp-post.$$ >/dev/null && same=yes; local led; led=$(ledger $db "$ver")
  local got; if [ $st -ne 0 ] && [ $same = yes ] && [ "$led" = 0 ]; then got=rolledback; elif [ $same = no ] && [ "$led" = 0 ]; then got=split; else got="other(exit $st, schema_unchanged=$same, ledger=$led)"; fi
  [ "$got" = "$expect" ] && ok "$label: exit $st, schema unchanged=$same, ledger rows=$led -> $got" || no "$label: expected $expect, got $got"
  drop $db
}
echo "== OLD (frozen db-migrate.yml order: -f FILE then -c ledger), causal controls"
case_run "C1 frozen, WRAPPED 000000, failure at ledger insertion" frozen "$f0" 20261101000000 "$INJ_LEDGER" split
case_run "C2 frozen, WRAPPED 000100, failure at ledger insertion" frozen "$f1" 20261101000100 "$INJ_LEDGER" split
case_run "C3 frozen, NONE 000200, failure at ledger insertion (unwrapped files were already atomic)" frozen "$f2" 20261101000200 "$INJ_LEDGER" rolledback
echo "== NEW (apply-atomic.sh: ledger first, same transaction)"
case_run "A1 atomic, WRAPPED 000000, failure at ledger insertion" atomic "$f0" 20261101000000 "$INJ_LEDGER" rolledback
case_run "A2 atomic, WRAPPED 000100, failure at ledger insertion" atomic "$f1" 20261101000100 "$INJ_LEDGER" rolledback
case_run "A3 atomic, WRAPPED 000000, failure after its last DDL before its COMMIT" atomic "$f0" 20261101000000 "$(inj_ddl quiz_submission_answers raise)" rolledback
case_run "A4 atomic, WRAPPED 000000, connection terminated after its last DDL before its COMMIT" atomic "$f0" 20261101000000 "$(inj_ddl quiz_submission_answers terminate)" rolledback
case_run "A5 atomic, WRAPPED 000100, connection terminated after its last DDL" atomic "$f1" 20261101000100 "$(inj_ddl start_quiz_attempt terminate)" rolledback
case_run "A6 atomic, NONE 000200, failure after its last DDL" atomic "$f2" 20261101000200 "$(inj_ddl pin_quiz_submission_score raise)" rolledback
echo "== Refusals (nothing executed)"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
printf 'begin;\ncreate table x(a int);\ncommit;\ncreate table y(a int);\n' > "$W/20990101000000_mid_commit.sql"
PGURL=postgresql://nobody@127.0.0.1:1/none bash "$HERE/apply-atomic.sh" "$W/20990101000000_mid_commit.sql" 20990101000000 > /tmp/out.$$ 2>&1; [ $? = 20 ] && ok "R1 statement after the file's COMMIT refused (exit 20) before any connection" || no "R1 $(head -1 /tmp/out.$$)"
printf 'create table x(a int);\nsavepoint s;\n' > "$W/20990101000001_savepoint.sql"
PGURL=postgresql://nobody@127.0.0.1:1/none bash "$HERE/apply-atomic.sh" "$W/20990101000001_savepoint.sql" 20990101000001 > /tmp/out.$$ 2>&1; [ $? = 20 ] && ok "R2 SAVEPOINT refused (exit 20)" || no "R2 $(head -1 /tmp/out.$$)"
printf 'do $x$ begin commit; end $x$;\n' > "$W/20990101000002_quoted.sql"
node "$HERE/txn-control.mjs" "$W/20990101000002_quoted.sql" | grep -q 'NONE' && ok "R3 COMMIT inside a dollar-quoted body is not top-level (NONE)" || no "R3"
PGURL=x bash "$HERE/apply-atomic.sh" "$f0" 20261101000100 > /tmp/out.$$ 2>&1; [ $? = 30 ] && ok "R4 version not equal to filename digits refused (exit 30)" || no "R4"
echo "== Order: a higher version is refused while a lower one is unrecorded"
db=atomic_ord_$$; fresh $db; fp $db > /tmp/fp-pre.$$
atomic $db "$(ls "$MIG"/20261101000100_*.sql)" 20261101000100 > /tmp/out.$$ 2>&1; st=$?
[ $st = 33 ] && [ "$(ledger $db 20261101000100)" = 0 ] && fp $db | diff -q - /tmp/fp-pre.$$ >/dev/null && ok "O1 000100 before 000000: refused (exit 33), nothing executed, ledger 0" || no "O1 exit $st"
drop $db
echo "== Positive: all 7 in order through apply-atomic.sh"
db=atomic_all_$$; fresh $db; okall=1
for f in $(ls "$MIG"/2026110100*.sql | sort); do v=$(basename "$f" | cut -c1-14); atomic $db "$f" $v > /tmp/out.$$ 2>&1 || { okall=0; no "P1 apply $v: $(tail -1 /tmp/out.$$)"; }; done
[ $okall = 1 ] && ok "P1 seven files applied, each with its ledger row ($(psql -X -At "$BASE/$db" -c "select count(*) from supabase_migrations.schema_migrations where version like '2026110100%'") rows)"
fp $db | diff - "$NEWFP" > /tmp/out.$$ && ok "P2 resulting functions/policies/triggers identical to the composed NEW fingerprint ($(wc -l < "$NEWFP") objects)" || no "P2 differs: $(grep -c '^[<>]' /tmp/out.$$) lines"
drop $db; rm -f /tmp/fp-pre.$$ /tmp/fp-post.$$ /tmp/out.$$
echo "== psql metacommands are refused before any connection (exit 23)"
M=$(mktemp -d)
printf "create table m1_a(a int);\nselect 'commit' \\\\gexec\ncreate table m1_b(a int);\n" > "$M/20990102000001_gexec.sql"
printf "\\\\set ON_ERROR_STOP off\ncreate table m2_a(a int);\nselect 1/0;\n" > "$M/20990102000002_onerr.sql"
printf "commit;\n" > "$M/inc.sql"; printf "create table m3_a(a int);\n\\\\include $M/inc.sql\n" > "$M/20990102000003_include.sql"
printf "select E'a\\\\\\\\b', \$q\$ \\\\x \$q\$; -- \\\\c in a comment\n" > "$M/20990102000004_quoted_backslash.sql"
for f in 20990102000001_gexec 20990102000002_onerr 20990102000003_include; do
  PGURL=postgresql://nobody@127.0.0.1:1/none bash "$HERE/apply-atomic.sh" "$M/$f.sql" "${f:0:14}" > /tmp/out.$$ 2>&1; st=$?
  [ $st = 23 ] && ok "M-$f refused before connecting (exit 23)" || no "M-$f exit $st"; done
node "$HERE/txn-control.mjs" "$M/20990102000004_quoted_backslash.sql" > /tmp/out.$$ 2>&1 && ok "M-quoted backslashes inside E-string, dollar body and comment are not metacommands ($(cat /tmp/out.$$))" || no "M-quoted $(cat /tmp/out.$$)"
rm -rf "$M"
echo "== duplicate and simultaneous same-version dispatch (ledger PRIMARY KEY on version)"
probe="create sequence ddl_probe; create function ddl_probe_fn() returns event_trigger language plpgsql as \$\$ begin perform nextval('ddl_probe'); end \$\$; create event trigger ddl_probe on ddl_command_start execute function ddl_probe_fn();"
pk=$(psql -X -At "$BASE/$TPL" -c "select pg_get_constraintdef(oid) from pg_constraint where conrelid='supabase_migrations.schema_migrations'::regclass and contype='p'")
[ "$pk" = "PRIMARY KEY (version)" ] && ok "D0 ledger has PRIMARY KEY (version)" || no "D0 ledger key: $pk"
db=atomic_dup_$$; fresh $db; atomic $db "$f0" 20261101000000 > /tmp/out.$$ 2>&1 || no "D1 setup apply failed"
psql -X -q -v ON_ERROR_STOP=1 "$BASE/$db" -c "$probe" >/dev/null
atomic $db "$f0" 20261101000000 > /tmp/out.$$ 2>&1; st=$?; n=$(psql -X -At "$BASE/$db" -c "select last_value * (is_called::int) from ddl_probe")
[ $st -ne 0 ] && grep -q 'duplicate key value violates unique constraint "schema_migrations_pkey"' /tmp/out.$$ && [ "$n" = 0 ] && [ "$(ledger $db 20261101000000)" = 1 ] \
  && ok "D1 re-dispatch of an applied version: ledger INSERT fails first (pkey), 0 file DDL statements started, ledger still 1" || no "D1 exit $st, file DDL started $n"
drop $db
db=atomic_race_$$; fresh $db; psql -X -q -v ON_ERROR_STOP=1 "$BASE/$db" -c "$probe" >/dev/null
# Hold a lock so the first runner sits inside its transaction (ledger row inserted, file blocked) while the second starts.
( psql -X -q "$BASE/$db" -c "begin; lock table public.content_item_progressions in access exclusive mode; select pg_sleep(3); commit;" >/dev/null 2>&1 ) & L=$!
sleep 0.5
( atomic $db "$f0" 20261101000000 > /tmp/race1.$$ 2>&1; echo $? > /tmp/race1.st.$$ ) & A=$!
sleep 0.5
( atomic $db "$f0" 20261101000000 > /tmp/race2.$$ 2>&1; echo $? > /tmp/race2.st.$$ ) & B=$!
wait $L $A $B; s1=$(cat /tmp/race1.st.$$); s2=$(cat /tmp/race2.st.$$); n=$(psql -X -At "$BASE/$db" -c "select last_value * (is_called::int) from ddl_probe")
wins=$(( (s1==0) + (s2==0) )); dup=$(cat /tmp/race1.$$ /tmp/race2.$$ | grep -c 'schema_migrations_pkey')
[ $wins = 1 ] && [ $dup = 1 ] && [ "$n" = 6 ] && [ "$(ledger $db 20261101000000)" = 1 ] \
  && ok "D2 simultaneous same version: exactly one commits; the loser waits on the ledger key, then fails its INSERT before the file (file DDL started 6 = one run of 000000), ledger 1" \
  || no "D2 exits $s1/$s2, pkey failures $dup, file DDL started $n"
psql -X -At "$BASE/$db" -c "select 1" >/dev/null; P2=$(fp $db | sort | md5sum | cut -c1-32); drop $db; rm -f /tmp/race*.$$
echo "== outcome unknown: read-only reconciliation (verify-applied.sh), never auto-rollback or blind re-run"
V="$HERE/verify-applied.sh"
db=atomic_v_$$; fresh $db
WRITER_RUN_TERMINAL=1000001:failure PGURL="$BASE/$db" bash "$V" 20261101000000 > /tmp/out.$$; st=$?; [ $st = 40 ] && ok "V0 fresh target: $(head -c 120 /tmp/out.$$)" || no "V0 exit $st $(cat /tmp/out.$$)"
( atomic $db "$f0" 20261101000000 >/dev/null 2>&1 ) ; # L1: runner exit status and output DISCARDED (response lost after COMMIT)
PGURL="$BASE/$db" bash "$V" 20261101000000 > /tmp/out.$$; st=$?; [ $st = 0 ] && ok "L1 response lost AFTER commit: $(cat /tmp/out.$$)" || no "L1 exit $st $(cat /tmp/out.$$)"
drop $db; db=atomic_v2_$$; fresh $db
( psql -X -q "$BASE/$db" -c "begin; lock table public.content_item_progressions in access exclusive mode; select pg_sleep(2); commit;" >/dev/null 2>&1 ) & L=$!
sleep 0.4; ( PGURL="$BASE/$db" exec psql "$BASE/$db" -X -q -v ON_ERROR_STOP=1 --single-transaction -c "insert into supabase_migrations.schema_migrations (version) values ('20261101000000')" -f "$f0" >/dev/null 2>&1 ) & C=$!
sleep 0.6; waiting=$(psql -X -At "$BASE/$db" -c "select count(*) from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and pid <> pg_backend_pid()"); kill -9 $C 2>/dev/null; wait $L 2>/dev/null; sleep 1.5
WRITER_RUN_TERMINAL=1000001:failure PGURL="$BASE/$db" bash "$V" 20261101000000 > /tmp/out.$$; st=$?; [ $st = 40 ] && [ "${waiting:-0}" -ge 1 ] && ok "L2 client killed BEFORE commit while its backend was inside the file (lock waiters before kill: $waiting): $(cat /tmp/out.$$)" || no "L2 exit $st $(cat /tmp/out.$$)"
psql -X -q "$BASE/$db" -c "insert into supabase_migrations.schema_migrations (version) values ('20261101000000')" >/dev/null
PGURL="$BASE/$db" bash "$V" 20261101000000 > /tmp/out.$$; st=$?; [ $st = 41 ] && ok "L3 ledger row without the schema (forged here): $(cat /tmp/out.$$)" || no "L3 exit $st $(cat /tmp/out.$$)"
drop $db; rm -f /tmp/out.$$; rm -rf "$SOLO"
echo "== atomic apply selftest (LOCAL scratch DBs only): $pass PASS, $fail FAIL"; [ $fail = 0 ]
