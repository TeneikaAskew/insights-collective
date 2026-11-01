#!/usr/bin/env bash
# ABOUTME: Self-test of the lesson-editor fixture guards and of the SQL-level write contract, on a LOCAL PG16 cluster with the
# ABOUTME: managed layout SIMULATED (T-09's simulate-managed-stack.sql + bootstrap.sh). Evidence tier: LOCAL-SIM, not acceptance.
# Usage: guards-selftest.sh <loopback libpq url WITHOUT database>
#   LE_ST_CONTROL=no-trigger|no-rls  causal control on the scratch database only: drops the version trigger, or disables RLS
#   on content_items, after the fixture is applied. The S checks that depend on it must then FAIL (expected exit 1).
#   Needs the T-09 harness files in the same tree (scripts/local-stack/t09, bootstrap.sh). Creates databases le_st_* and only the
#   missing managed roles, and drops exactly those on exit. RLS here runs as role authenticated with request.jwt.claims set
#   (the shim's auth.uid()); PostgREST, GoTrue and PG15 parity are NOT exercised here; backend-contract.mjs does that on the
#   real stack.
set -u
PGBASE="${1:?loopback libpq url WITHOUT database}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGBASE/postgres" >/dev/null || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
rc=0; npass=0; nfail=0
say() { if [ "$2" -eq 0 ]; then echo "PASS $1"; npass=$((npass+1)); else echo "FAIL $1"; nfail=$((nfail+1)); rc=1; fi; }
CREATED_ROLES=(); DBS=()
for r in supabase_admin supabase_auth_admin supabase_storage_admin authenticator anon authenticated service_role; do
  [ "$(psql "$PGBASE/postgres" -Atc "select count(*) from pg_roles where rolname='$r'")" = 1 ] || { psql "$PGBASE/postgres" -qc "create role $r nologin" >/dev/null && CREATED_ROLES+=("$r"); }
done
cleanup() { for d in "${DBS[@]:-}"; do [ -n "$d" ] && psql "$PGBASE/postgres" -qc "drop database if exists $d" >/dev/null 2>&1; done
            for r in "${CREATED_ROLES[@]:-}"; do [ -n "$r" ] && psql "$PGBASE/postgres" -qc "drop role if exists $r" >/dev/null 2>&1; done; }
trap cleanup EXIT
DB=le_st_main; DBS+=("$DB"); U="$PGBASE/$DB"
psql "$PGBASE/postgres" -qc "drop database if exists $DB" >/dev/null 2>&1; psql "$PGBASE/postgres" -qc "create database $DB" >/dev/null
psql "$U" -q -f "$ROOT/scripts/local-db/supabase-shim.sql" >/dev/null 2>&1
psql "$U" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-stack/tests/simulate-managed-stack.sql" >/dev/null || { echo "FAIL simulate"; exit 1; }
out=$(timeout 600 "$ROOT/scripts/local-stack/bootstrap.sh" "$U" 2>&1); st=$?
[ $st -eq 0 ] || { echo "$out" | tail -5; echo "FAIL bootstrap (prerequisite)"; exit 1; }
echo "     bootstrap OK on the SIMULATED layout (PG16)"

OWNER=11111111-1111-4111-8111-000000000001; OTHER=11111111-1111-4111-8111-000000000002; STUDENT=11111111-1111-4111-8111-000000000003
psql "$U" -v ON_ERROR_STOP=1 -q <<SQL >/dev/null || { echo "FAIL persona users"; exit 1; }
insert into auth.users (id, email, raw_user_meta_data) values
 ('$OWNER','le-owner-0a1b2c3d@local.test','{}'), ('$OTHER','le-other-0a1b2c3d@local.test','{}'), ('$STUDENT','le-student-0a1b2c3d@local.test','{}');
SQL
ACK='-c le.fixture_ack=isolated-local-stack'
apply() { PGOPTIONS="${1}" psql "$U" -X -q -v owner="$2" -v other="$OTHER" -v student="$STUDENT" -f "$HERE/fixture.sql" 2>&1; }
items() { psql "$U" -Atc "select count(*) from public.content_items where course_id='ed170000-0000-4000-8000-0000000000c1'"; }

# G1 no acknowledgement: refused before any write
out=$(apply "" "$OWNER"); st=$?; [ $st -ne 0 ] && grep -q "apply it only through" <<<"$out" && [ "$(items)" = 0 ]; say "G1 fixture without the run.sh acknowledgement is refused and writes nothing" $?
# G2 a persona id that is not an le-* local.test account
out=$(apply "$ACK" "22222222-2222-4222-8222-000000000009"); st=$?; [ $st -ne 0 ] && grep -q "is not an le-\* local.test account" <<<"$out" && [ "$(items)" = 0 ]; say "G2 a non-persona OWNER id is refused and writes nothing" $?
# G3 any non-synthetic account present: refused (then removed again; it was added by this test only)
psql "$U" -qc "insert into auth.users (id, email, raw_user_meta_data) values ('33333333-3333-4333-8333-000000000001','someone@example.com','{}')" >/dev/null
out=$(apply "$ACK" "$OWNER"); st=$?; [ $st -ne 0 ] && grep -q "non-synthetic auth user" <<<"$out" && [ "$(items)" = 0 ]; say "G3 a non-synthetic auth user makes the fixture refuse (not the isolated stack)" $?
psql "$U" -qc "delete from public.profiles where id='33333333-3333-4333-8333-000000000001'; delete from public.user_roles where user_id='33333333-3333-4333-8333-000000000001'; delete from auth.users where id='33333333-3333-4333-8333-000000000001'" >/dev/null
# G4 positive
out=$(apply "$ACK" "$OWNER"); st=$?; [ $st -eq 0 ] && grep -q "PASS le-fixture" <<<"$out" && [ "$(items)" = 6 ]; say "G4 fixture applies on the bootstrapped snapshot schema (6 items, N and KN NULL, quiz + 2 questions)" $?
# G5 never applied twice
out=$(apply "$ACK" "$OWNER"); st=$?; [ $st -ne 0 ] && grep -q "already exists" <<<"$out" && [ "$(items)" = 6 ]; say "G5 a second apply is refused (fixture is once per fresh stack, never reset)" $?

case "${LE_ST_CONTROL:-}" in
  '') ;;
  no-trigger) psql "$U" -qc "drop trigger update_content_items_updated_at on public.content_items" >/dev/null; echo "CONTROL no-trigger: version trigger dropped on $DB" ;;
  no-rls) psql "$U" -qc "alter table public.content_items disable row level security" >/dev/null; echo "CONTROL no-rls: RLS disabled on $DB" ;;
  *) echo "unknown LE_ST_CONTROL"; exit 2 ;;
esac
# SQL-level contract under the snapshot RLS, as role authenticated with the persona's claims (LOCAL-SIM).
as() { # persona-id, sql -> rows changed
  psql "$U" -X -qAt -v ON_ERROR_STOP=1 <<SQL
begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"$1","role":"authenticated"}', true) \\g /dev/null
$2
commit;
SQL
}
upd() { echo "with u as (update public.content_items set title = '$3', updated_at = '2001-01-01T00:00:00Z' where id = '$1' and $2 returning 1) select count(*) from u;"; }
K=ed170000-0000-4000-8000-0000000000b1; KN=ed170000-0000-4000-8000-0000000000b2
v0=$(psql "$U" -Atc "select updated_at from public.content_items where id='$K'")
n=$(as "$OWNER" "$(upd $K "updated_at = '$v0'" 'K1')"); [ "$n" = 1 ]; say "S1 OWNER conditional write on the current version changes 1 row" $?
v1=$(psql "$U" -Atc "select updated_at from public.content_items where id='$K'")
[ "$v1" != "$v0" ] && [ "$(psql "$U" -Atc "select updated_at <> '2001-01-01T00:00:00Z'::timestamptz from public.content_items where id='$K'")" = t ]; say "S2 the BEFORE UPDATE trigger replaced the client updated_at and advanced the version" $?
n=$(as "$OWNER" "$(upd $K "updated_at = '$v0'" 'stale')"); [ "$n" = 0 ]; say "S3 a stale version changes 0 rows" $?
n=$(as "$OWNER" "$(upd $KN "updated_at is null" 'KN1')"); [ "$n" = 1 ]; say "S4 IS NULL write on a NULL version changes 1 row" $?
n=$(as "$OWNER" "$(upd $KN "updated_at is null" 'KN late')"); [ "$n" = 0 ] && [ "$(psql "$U" -Atc "select title from public.content_items where id='$KN'")" = KN1 ]; say "S5 a second IS NULL write changes 0 rows (fence)" $?
n=$(as "$OTHER" "$(upd $K "updated_at = '$v1'" 'other')"); [ "$n" = 0 ]; say "S6 OTHER instructor with the exact version changes 0 rows (RLS)" $?
vnow=$(psql "$U" -Atc "select updated_at from public.content_items where id='$K'")  # independent of S6's outcome
n=$(as "$STUDENT" "$(upd $K "updated_at = '$vnow'" 'student')"); [ "$n" = 0 ]; say "S7 STUDENT with the exact version changes 0 rows (RLS)" $?
[ "$(psql "$U" -Atc "select title from public.content_items where id='$K'")" = K1 ]; say "S8 K unchanged after denied writes" $?

# Runner guards (no network, no stack needed)
out=$("$HERE/run.sh" read "postgresql://postgres@db.example.com:5432/postgres" ed170000-0000-4000-8000-0000000000a1 2>&1); [ $? -ne 0 ] && grep -q "not loopback" <<<"$out"; say "R1 run.sh refuses a non-loopback DSN" $?
out=$("$HERE/run.sh" read "$U" 660e8400-e29b-41d4-a716-446655440001 2>&1); [ $? -ne 0 ] && grep -q "only fixture ids" <<<"$out"; say "R2 run.sh read refuses a non-fixture id" $?
row=$("$HERE/run.sh" read "$U" ed170000-0000-4000-8000-0000000000a1); node -e 'const r=JSON.parse(process.argv[1]); process.exit(r && r.type==="page" && r.title==="Lesson A" ? 0 : 1)' "$row"; say "R3 run.sh read returns the fixture row" $?
[ "$("$HERE/run.sh" read "$U" ed170000-0000-4000-8000-0000000000ff)" = null ]; say "R4 run.sh read of an absent fixture id returns null" $?
W=$(mktemp -d); printf '{"OWNER":{"id":"%s"},"OTHER":{"id":"%s"}}' "$OWNER" "$OTHER" > "$W/personas.json"
"$HERE/run.sh" owner "$U" "$W" OTHER >/dev/null && [ "$(psql "$U" -Atc "select instructor_id from public.courses where id='ed170000-0000-4000-8000-0000000000c1'")" = "$OTHER" ]; say "R5 run.sh owner OTHER moves only C1 (RLS-ZERO-ROW setup)" $?
n=$(as "$OWNER" "$(upd ed170000-0000-4000-8000-0000000000a1 "true" 'after move')"); [ "$n" = 0 ]; say "R6 after the move OWNER writes 0 rows (the real RLS-ZERO-ROW condition)" $?
"$HERE/run.sh" owner "$U" "$W" OWNER >/dev/null && [ "$(psql "$U" -Atc "select instructor_id from public.courses where id='ed170000-0000-4000-8000-0000000000c1'")" = "$OWNER" ]; say "R7 run.sh owner OWNER restores C1" $?
h1=$("$HERE/run.sh" quizhash "$U"); h2=$("$HERE/run.sh" quizhash "$U"); [ -n "$h1" ] && [ "$h1" = "$h2" ]; say "R8 quizhash is stable and read-only" $?
rm -rf "$W"
echo "le guards-selftest: $npass passed, $nfail failed (LOCAL-SIM: PG16, simulated managed layout; NOT PostgREST/GoTrue/PG15)"
exit $rc
