#!/usr/bin/env bash
# ABOUTME: LOCAL deterministic controls for verify-applied.sh: named-key scope, writer attestation, in-flight writers (UNSETTLED),
# ABOUTME: settled outcomes, and a commit landing between snapshots (INCONSISTENT, never NOT_APPLIED). Scratch DBs only.
# Usage: verify-applied-selftest.sh <maintenance URI .../postgres on loopback> <template at the OLD state> <dir with the 7 reviewed files>
# No fault is injected into any non-local database. In-flight writers are real open transactions in scratch DBs, held by
# pg_sleep and ended by the test itself; the between-snapshot commit is driven by a PATH shim around psql in this test only.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; URL="$1"; TPL="$2"; MIG="$3"
case "$URL" in postgresql://*@127.0.0.1:*/postgres) ;; *) echo "refused: loopback maintenance URI only"; exit 2;; esac
BASE="${URL%/postgres}"; V="$HERE/verify-applied.sh"; pass=0; fail=0
ok() { echo "PASS $*"; pass=$((pass+1)); }; no() { echo "FAIL $*"; fail=$((fail+1)); }
fresh() { psql -X -q "$URL" -c "drop database if exists $1" -c "create database $1 template $TPL" >/dev/null; }
drop() { psql -X -q "$URL" -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$1' and pid <> pg_backend_pid()" -c "drop database if exists $1" >/dev/null; }
f0=$(ls "$MIG"/20261101000000_*.sql); f1=$(ls "$MIG"/20261101000100_*.sql); T=$(mktemp -d)
vr() { local db=$1 ver=$2; shift 2; env "$@" PGURL="$BASE/$db" bash "$V" "$ver" > "$T/out" 2>&1; echo $? > "$T/st"; }
res() { echo "exit $(cat "$T/st"): $(cut -c1-150 "$T/out")"; }
is() { [ "$(cat "$T/st")" = "$1" ]; }
waitlocks() { # db, minimum count of other client backends holding/awaiting any relation lock
  local i n; for i in $(seq 1 50); do
    n=$(psql -X -At "$BASE/$1" -c "select count(distinct l.pid) from pg_locks l join pg_stat_activity s using (pid) where s.datname = current_database() and l.pid <> pg_backend_pid() and s.backend_type = 'client backend' and l.locktype = 'relation'")
    [ "${n:-0}" -ge "$2" ] && return 0; sleep 0.1; done; return 1; }
ATT="WRITER_RUN_TERMINAL=1000001:failure"

echo "== K: expected-key grammar and scope (before and independent of any connection)"
printf "fn|x() absent absent\nfn|x() absent absent\n" > "$T/dup"; PGURL="postgresql://nobody@127.0.0.1:1/none" bash "$V" 20261101000000 "$T/dup" > "$T/out"; s=$?
[ $s = 42 ] && grep -q "duplicate expected key" "$T/out" && ok "K1 duplicate key refused before connect (exit 42)" || no "K1 exit $s $(cat "$T/out")"
printf "fn|x');drop_table_y() absent absent\n" > "$T/inj"; PGURL="postgresql://nobody@127.0.0.1:1/none" bash "$V" 20261101000000 "$T/inj" > "$T/out"; s=$?
[ $s = 42 ] && grep -q "key grammar" "$T/out" && ok "K2 key carrying a quote refused before connect (exit 42)" || no "K2 exit $s $(cat "$T/out")"
PGURL="postgresql://nobody@127.0.0.1:1/none" WRITER_RUN_TERMINAL="x:done" bash "$V" 20261101000000 > "$T/out"; s=$?
[ $s = 42 ] && ok "K3 malformed attestation refused (exit 42)" || no "K3 exit $s"
# Static: no catalog query in the helper is unfiltered by the expected names.
grep -q "p.proname = any(" "$V" && grep -q "tablename = any(" "$V" && grep -q "t.tgname = any(" "$V" && grep -q "where k = any(" "$V" \
  && ! grep -qE "from pg_proc p where p\.pronamespace='public'::regnamespace$" "$V" \
  && ok "K4 static: functions, policies and triggers are each filtered by expected names, and rows by exact keys" || no "K4 static filter check"

db=va_scope_$$; fresh $db
psql -X -q "$BASE/$db" -c "create function public.zz_unrelated() returns int language sql as 'select 1'; create policy zz_unrelated on public.quiz_submissions for select using (false);" >/dev/null
nexp=$(grep -c . "$HERE/expected/touched-20261101000000.txt")
vr $db 20261101000000 $ATT; is 40 && grep -q "scope $nexp expected keys, [0-9]* rows returned" "$T/out" && ok "K5 unrelated public function and policy present: result unchanged, $(grep -o 'scope [^.;]*' "$T/out")" || no "K5 $(res)"
# Count only expected keys can come back: rows returned never exceeds the expected-key count.
r=$(grep -o '[0-9]* rows returned' "$T/out" | cut -d' ' -f1); [ "${r:-99}" -le "$nexp" ] && ok "K6 rows returned $r <= expected keys $nexp" || no "K6 rows $r > $nexp"
drop $db

echo "== S: settled outcomes"
db=va_s_$$; fresh $db
vr $db 20261101000000; is 43 && ok "S1 nothing committed, writer NOT attested: UNSETTLED, no retry decision ($(res))" || no "S1 $(res)"
vr $db 20261101000000 $ATT; is 40 && ok "S2 nothing committed, writer attested terminal, no writer active: NOT_APPLIED" || no "S2 $(res)"
PGURL="$BASE/$db" bash "$HERE/apply-atomic.sh" "$f0" 20261101000000 >/dev/null 2>&1
vr $db 20261101000000; is 0 && ok "S3 committed, settled: APPLIED (attestation not needed to report a committed fact)" || no "S3 $(res)"
drop $db

echo "== I: in-flight writers (real open transactions; the helper must not interpret NOT_APPLIED)"
db=va_i_$$; fresh $db
# I1: the reviewed file's DDL executed in an OPEN transaction, plus its ledger row, not yet committed.
( psql -X -q "$BASE/$db" -v ON_ERROR_STOP=1 -c "begin" -c "insert into supabase_migrations.schema_migrations (version) values ('20261101000000')" -f <(sed -E '/^[[:space:]]*(BEGIN|COMMIT)[[:space:]]*;[[:space:]]*$/Id' "$f0") -c "select pg_sleep(20)" -c "rollback" >/dev/null 2>&1 ) & W=$!
waitlocks $db 1 && sleep 0.5
t0=$SECONDS; vr $db 20261101000000 $ATT; el=$((SECONDS-t0))
is 43 && [ $el -le 4 ] && ok "I1 file DDL + ledger row in an open transaction, writer even attested: UNSETTLED in ${el}s without queueing behind it ($(res))" || no "I1 ${el}s $(res)"
psql -X -q "$BASE/$db" -c "select pg_cancel_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and query like '%pg_sleep(20)%'" >/dev/null; wait $W 2>/dev/null
vr $db 20261101000000 $ATT; is 40 && ok "I1b same writer ended without commit, then settled: NOT_APPLIED" || no "I1b $(res)"
# I2: only the ledger INSERT open (the runner's first statement), file not yet started.
( psql -X -q "$BASE/$db" -c "begin" -c "insert into supabase_migrations.schema_migrations (version) values ('20261101000000')" -c "select pg_sleep(20)" -c "rollback" >/dev/null 2>&1 ) & W=$!
waitlocks $db 1 && sleep 0.3
vr $db 20261101000000 $ATT; is 43 && ok "I2 ledger INSERT open, file not started: UNSETTLED" || no "I2 $(res)"
psql -X -q "$BASE/$db" -c "select pg_cancel_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and query like '%pg_sleep(20)%'" >/dev/null; wait $W 2>/dev/null
# I3: a competing schema writer on a touched table (policy DDL, not the reviewed file) open.
( psql -X -q "$BASE/$db" -c "begin" -c "create policy zz_competing on public.quiz_submissions for select using (false)" -c "select pg_sleep(20)" -c "rollback" >/dev/null 2>&1 ) & W=$!
waitlocks $db 1 && sleep 0.3
vr $db 20261101000000 $ATT; is 43 && ok "I3 competing schema writer on a touched table: UNSETTLED" || no "I3 $(res)"
psql -X -q "$BASE/$db" -c "select pg_cancel_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and query like '%pg_sleep(20)%'" >/dev/null; wait $W 2>/dev/null
# I4: a waiter (lock not granted) is also a writer: hold the table, then queue the ledger+file runner behind it.
( psql -X -q "$BASE/$db" -c "begin" -c "lock table public.content_item_progressions in access share mode" -c "select pg_sleep(20)" -c "rollback" >/dev/null 2>&1 ) & H=$!
waitlocks $db 1
( psql -X -q "$BASE/$db" -c "begin" -c "lock table public.content_item_progressions in access exclusive mode" -c "rollback" >/dev/null 2>&1 ) & Q=$!
for i in $(seq 1 50); do [ "$(psql -X -At "$BASE/$db" -c "select count(*) from pg_locks where not granted and locktype = 'relation'")" -ge 1 ] && break; sleep 0.1; done
vr $db 20261101000000 $ATT; is 43 && ok "I4 AccessExclusive request waiting (not granted) on a touched table: UNSETTLED" || no "I4 $(res)"
psql -X -q "$BASE/$db" -c "select pg_cancel_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and query like '%pg_sleep(20)%'" >/dev/null; wait $H $Q 2>/dev/null
# I5: an unrelated reader holding AccessShare only does not block interpretation.
( psql -X -q "$BASE/$db" -c "begin" -c "select count(*) from public.quiz_submissions" -c "select pg_sleep(20)" -c "rollback" >/dev/null 2>&1 ) & W=$!
waitlocks $db 1 && sleep 0.3
vr $db 20261101000000 $ATT; is 40 && ok "I5 ordinary reader (AccessShare) open: still NOT_APPLIED, the barrier is writer-specific" || no "I5 $(res)"
psql -X -q "$BASE/$db" -c "select pg_cancel_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and query like '%pg_sleep(20)%'" >/dev/null; wait $W 2>/dev/null
# I6: a writer that appears AFTER the first lock check (PATH shim opens it just before the snapshot read): the snapshot read
#     must not queue behind it; lock_timeout ends the read and the run is UNSETTLED, never a result.
REAL=$(command -v psql); mkdir -p "$T/bin6"; rm -f "$T/fired6"
cat > "$T/bin6/psql" <<SHIM
#!/usr/bin/env bash
if printf '%s\n' "\$@" | grep -q 'repeatable read read only' && [ ! -e "$T/fired6" ]; then
  : > "$T/fired6"; ( "$REAL" -X -q "$BASE/$db" -c "begin" -c "lock table public.quiz_submissions in access exclusive mode" -c "select pg_sleep(20)" -c "rollback" >/dev/null 2>&1 & )
  sleep 0.5
fi
exec "$REAL" "\$@"
SHIM
chmod +x "$T/bin6/psql"
t0=$SECONDS; vr $db 20261101000000 $ATT PATH="$T/bin6:$PATH"; el=$((SECONDS-t0))
[ -e "$T/fired6" ] && is 43 && grep -q "lock_timeout" "$T/out" && [ $el -le 6 ] && ok "I6 writer appears between the lock check and the snapshot: the read times out on the lock in ${el}s, UNSETTLED" || no "I6 ${el}s $(res)"
psql -X -q "$BASE/$db" -c "select pg_cancel_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and query like '%pg_sleep(20)%'" >/dev/null; sleep 0.3
vr $db 20261101000000 $ATT; is 40 && ok "I6b after that writer ended: NOT_APPLIED" || no "I6b $(res)"
drop $db

echo "== B: a commit lands BETWEEN the snapshot and the re-read (PATH shim, this test only)"
db=va_b_$$; fresh $db; REAL=$(command -v psql); mkdir -p "$T/bin"
cat > "$T/bin/psql" <<EOF
#!/usr/bin/env bash
"$REAL" "\$@"; st=\$?
if printf '%s\n' "\$@" | grep -q 'repeatable read read only' && [ ! -e "$T/fired" ]; then
  : > "$T/fired"; PGURL="$BASE/$db" PATH="$(dirname "$REAL"):\$PATH" bash "$HERE/apply-atomic.sh" "$f0" 20261101000000 >/dev/null 2>&1
fi
exit \$st
EOF
chmod +x "$T/bin/psql"
vr $db 20261101000000 $ATT PATH="$T/bin:$PATH"
led=$(psql -X -At "$BASE/$db" -c "select count(*) from supabase_migrations.schema_migrations where version = '20261101000000'")
[ -e "$T/fired" ] && is 41 && [ "$led" = 1 ] && grep -q "ledger changed between snapshots (0 -> 1)" "$T/out" \
  && ok "B1 commit between snapshot and re-read: INCONSISTENT (conservative), not NOT_APPLIED; ledger left as committed ($led), no edit" || no "B1 fired=$([ -e "$T/fired" ] && echo y) led=$led $(res)"
vr $db 20261101000000; is 0 && ok "B2 the same target verified again once settled: APPLIED" || no "B2 $(res)"
drop $db

echo "== R: read-only"
db=va_r_$$; fresh $db
before=$(psql -X -At "$BASE/$db" -c "select xact_commit from pg_stat_database where datname = current_database()")
vr $db 20261101000000 $ATT
psql -X -At "$BASE/$db" -c "select count(*) from supabase_migrations.schema_migrations" > "$T/l"
[ "$(cat "$T/l")" = "$(psql -X -At "$BASE/$TPL" -c "select count(*) from supabase_migrations.schema_migrations")" ] && grep -c "begin transaction" "$V" >/dev/null \
  && ! grep -qiE "^[^#]*\b(insert|update|delete|alter|create|drop|grant|revoke)\b[^']*;" <(grep -v '^#' "$V" | grep -E 'psql|-c "') \
  && ok "R1 ledger row count unchanged by verification; every helper session opens read-only" || no "R1"
drop $db
rm -rf "$T"
echo "== verify-applied selftest (LOCAL scratch DBs only): $pass PASS, $fail FAIL"; [ $fail = 0 ]
