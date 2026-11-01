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
f0=$(ls "$MIG"/20261101000000_*.sql); f1=$(ls "$MIG"/20261101000100_*.sql); f2=$(ls "$MIG"/20261101000200_*.sql)
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
echo "== Positive: all 7 in order through apply-atomic.sh"
db=atomic_all_$$; fresh $db; okall=1
for f in $(ls "$MIG"/2026110100*.sql | sort); do v=$(basename "$f" | cut -c1-14); atomic $db "$f" $v > /tmp/out.$$ 2>&1 || { okall=0; no "P1 apply $v: $(tail -1 /tmp/out.$$)"; }; done
[ $okall = 1 ] && ok "P1 seven files applied, each with its ledger row ($(psql -X -At "$BASE/$db" -c "select count(*) from supabase_migrations.schema_migrations where version like '2026110100%'") rows)"
fp $db | diff - "$NEWFP" > /tmp/out.$$ && ok "P2 resulting functions/policies/triggers identical to the composed NEW fingerprint ($(wc -l < "$NEWFP") objects)" || no "P2 differs: $(grep -c '^[<>]' /tmp/out.$$) lines"
drop $db; rm -f /tmp/fp-pre.$$ /tmp/fp-post.$$ /tmp/out.$$
echo "== atomic apply selftest (LOCAL scratch DBs only): $pass PASS, $fail FAIL"; [ $fail = 0 ]
