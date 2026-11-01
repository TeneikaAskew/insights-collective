#!/usr/bin/env bash
# ABOUTME: LOCAL-SIM self-test of the lesson-editor fixture guards, preflight, runner and SQL write contract, on a THROWAWAY PG16
# ABOUTME: cluster this script creates and always removes (T-09 shim + simulated managed layout + PRE queue guard + bootstrap).
# Usage: guards-selftest.sh            (no argument: it never adopts a supplied cluster or database)
#   env PG_BIN (default /usr/lib/postgresql/16/bin). LE_ST_CONTROL=no-trigger|no-rls weakens the scratch DB AFTER the fixture
#   so the dependent checks must FAIL (causal controls; expected exit 1).
# What it is NOT: PostgREST, GoTrue, Kong or PG15 parity. HTTP probes here hit a FAKE (tests/fake-stack-http.mjs) and psql
# negatives use a FAKE psql on PATH; both are labelled and have no database side effect.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
npass=0; nfail=0
say() { if [ "$2" -eq 0 ]; then echo "PASS $1"; npass=$((npass+1)); else echo "FAIL $1"; nfail=$((nfail+1)); fi; }
die() { echo "FAIL prerequisite: $*"; exit 1; }
# Producer rule: an observation whose producer failed is a failed check, never an empty value that happens to compare.
# obs VAR cmd...: stores stdout in VAR, returns the producer's status (stderr withheld).
obs() { local __v="$1"; shift; local __o; __o=$("$@" 2>/dev/null); local __s=$?; printf -v "$__v" '%s' "$__o"; return $__s; }
for t in initdb pg_ctl; do [ -x "$PG_BIN/$t" ] || die "$PG_BIN/$t missing"; done
command -v psql >/dev/null || die "psql missing"

# ---------- throwaway cluster, owned by this run, always removed ----------
SCR=$(mktemp -d /tmp/le-selftest.XXXXXX) || die mktemp
AS=(); if [ "$(id -u)" = 0 ]; then id postgres >/dev/null 2>&1 || die "running as root needs a postgres OS user"; AS=(runuser -u postgres --); chown postgres "$SCR"; fi
PORT=$((56000 + RANDOM % 4000)); FAKE_PID=""
cleanup() {
  [ -n "$FAKE_PID" ] && kill "$FAKE_PID" 2>/dev/null
  [ -f "$SCR/data/postmaster.pid" ] && "${AS[@]}" "$PG_BIN/pg_ctl" -D "$SCR/data" stop -m immediate >/dev/null 2>&1
  rm -rf -- "$SCR"
}
trap cleanup EXIT
"${AS[@]}" "$PG_BIN/initdb" -D "$SCR/data" -A trust -U postgres >/dev/null 2>&1 || die initdb
"${AS[@]}" "$PG_BIN/pg_ctl" -D "$SCR/data" -o "-p $PORT -k $SCR -c listen_addresses=127.0.0.1" -l "$SCR/pg.log" -w start >/dev/null 2>&1 || die "pg_ctl start"
MAINT="postgresql://postgres@127.0.0.1:$PORT/postgres"               # canonical maintenance URI
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$MAINT" >/dev/null 2>&1 || die "maintenance URI refused"
DBNAME="le_st_$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
U=$(node -e 'const u=new URL(process.argv[1]); u.pathname="/"+process.argv[2]; console.log(u.toString())' "$MAINT" "$DBNAME") || die "derive DSN"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$U" >/dev/null 2>&1 || die "derived DSN refused"   # revalidated after derivation
[[ "$U" == "postgresql://postgres@127.0.0.1:$PORT/$DBNAME" ]] || die "derived DSN not canonical"
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
[ "$(psql "$MAINT" -XAtc "select count(*) from pg_database where datname = '$DBNAME'")" = 0 ] || die "database exists (never adopted)"
psql "$MAINT" -Xqc "create database $DBNAME" >/dev/null || die "create database"
echo "     throwaway cluster 127.0.0.1:$PORT (initdb in $SCR), database $DBNAME; removed on exit"
for r in supabase_admin supabase_auth_admin supabase_storage_admin authenticator anon authenticated service_role; do
  psql "$MAINT" -Xqc "create role $r nologin" >/dev/null || die "role $r (throwaway cluster only)"
done
T09="$ROOT/scripts/local-stack/t09"
psql "$U" -q -f "$ROOT/scripts/local-db/supabase-shim.sql" >/dev/null 2>&1
psql "$U" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-stack/tests/simulate-managed-stack.sql" >/dev/null 2>&1 || die simulate
psql "$U" -v ON_ERROR_STOP=1 -q -f "$T09/pgnet-queue-shim.sql" >/dev/null 2>&1 || die "pg_net queue shim"
psql "$U" -v ON_ERROR_STOP=1 -v allow_shim=1 -q -f "$T09/egress-guard.sql" >/dev/null 2>&1 || die "T-09 PRE queue guard"
timeout 600 "$ROOT/scripts/local-stack/bootstrap.sh" "$U" >/dev/null 2>&1 || die bootstrap
echo "     LOCAL-SHIM queue + T-09 PRE guard, then bootstrap OK on the SIMULATED layout (PG16)"

# ---------- preflight (read-only) against a FAKE API/app ----------
K="$SCR/keys"; mkdir -m 700 "$K"; printf 'fake-anon' >"$K/anon"; printf 'fake-service' >"$K/service"; chmod 600 "$K/anon" "$K/service"
APORT=$((PORT + 1)); BPORT=$((PORT + 2)); LOG="$SCR/fake.log"; : >"$LOG"
TABLES=$(psql "$U" -XAtc "select string_agg(tablename, ',') from pg_tables where schemaname='public'")
fake() { # restart the fake with the given env
  [ -n "$FAKE_PID" ] && kill "$FAKE_PID" 2>/dev/null && wait "$FAKE_PID" 2>/dev/null
  env "$@" node "$HERE/tests/fake-stack-http.mjs" "$APORT" "$BPORT" "$LOG" >"$SCR/fake.out" 2>&1 & FAKE_PID=$!
  for _ in $(seq 1 40); do grep -q ready "$SCR/fake.out" 2>/dev/null && return 0; sleep 0.1; done; die "fake http"
}
USERS=$(psql "$U" -XAtc "select count(*) from auth.users"); COURSES=$(psql "$U" -XAtc "select count(*) from public.courses")
API="http://127.0.0.1:$APORT"; APP="http://127.0.0.1:$BPORT"
pre() { LE_ALLOW_SHIM="${SHIM:-1}" node "$HERE/preflight.mjs" "$API" "$APP" "$U" "$K/anon" "$K/service" 2>&1; }
fake FAKE_USERS="$USERS" FAKE_COURSES="$COURSES" FAKE_TABLES="$TABLES" FAKE_BUNDLE=api
out=$(pre); st=$?; [ $st -eq 0 ] && grep -q "PASS le-preflight" <<<"$out"; say "P0 preflight passes on a fresh stack with the guard installed (fake HTTP, LOCAL-SHIM)" $?
out=$(SHIM=0 pre); [ $? -ne 0 ] && grep -q "LOCAL-SHIM queue found without LE_ALLOW_SHIM" <<<"$out"; say "P2a a LOCAL-SHIM queue is refused unless explicitly allowed" $?
psql "$U" -Xqc "alter table net.http_request_queue disable trigger t09_drop_http_request" >/dev/null
out=$(pre); [ $? -ne 0 ] && grep -q "guard trigger t09_drop_http_request absent or disabled" <<<"$out"; say "P2b a disabled queue guard is refused" $?
psql "$U" -Xqc "alter table net.http_request_queue enable always trigger t09_drop_http_request" >/dev/null
fake FAKE_USERS="$((USERS + 1))" FAKE_COURSES="$COURSES" FAKE_TABLES="$TABLES" FAKE_BUNDLE=api
out=$(pre); [ $? -ne 0 ] && grep -q "GoTrue reports" <<<"$out"; say "P3a an API whose user total differs from the database is refused" $?
fake FAKE_USERS="$USERS" FAKE_COURSES="$COURSES" FAKE_TABLES="courses" FAKE_BUNDLE=api
out=$(pre); [ $? -ne 0 ] && grep -q "fixture table(s) not both" <<<"$out"; say "P3b an API exposing another schema is refused" $?
fake FAKE_USERS="$USERS" FAKE_COURSES="$COURSES" FAKE_TABLES="$TABLES" FAKE_BUNDLE=hosted
out=$(pre); [ $? -ne 0 ] && grep -q "names a hosted" <<<"$out"; say "P4a an app built against a hosted project is refused" $?
fake FAKE_USERS="$USERS" FAKE_COURSES="$COURSES" FAKE_TABLES="$TABLES" FAKE_BUNDLE=none
out=$(pre); [ $? -ne 0 ] && grep -q "does not name" <<<"$out"; say "P4b an app not built against this API is refused" $?
fake FAKE_USERS="$USERS" FAKE_COURSES="$COURSES" FAKE_TABLES="$TABLES" FAKE_BUNDLE=api
# Setup must stop at preflight: guard disabled -> no private dir, no evidence dir, zero POSTs to the API.
psql "$U" -Xqc "alter table net.http_request_queue disable trigger t09_drop_http_request" >/dev/null
out=$(LE_ALLOW_SHIM=1 "$HERE/run.sh" setup "$API" "$APP" "$U" "$K/anon" "$K/service" "$SCR/private1" "$SCR/evid1" 2>&1); st=$?
psql "$U" -Xqc "alter table net.http_request_queue enable always trigger t09_drop_http_request" >/dev/null
[ $st -ne 0 ] && [ ! -e "$SCR/private1" ] && [ ! -e "$SCR/evid1" ] && ! grep -q "POST" "$LOG"; say "P5 setup stops at the read-only preflight: no private/evidence dir, zero API POSTs" $?
! grep -qE "POST|PATCH|PUT|DELETE" "$LOG"; say "P6 every preflight probe was a GET (fake request log)" $?

# ---------- fixture guards ----------
OWNER=11111111-1111-4111-8111-000000000001; OTHER=11111111-1111-4111-8111-000000000002; STUDENT=11111111-1111-4111-8111-000000000003
ACK='-c le.fixture_ack=isolated-local-stack'
apply() { PGOPTIONS="${1}" psql "$U" -X -q -v owner="$2" -v other="$OTHER" -v student="$STUDENT" -f "$HERE/fixture.sql" 2>&1; }
items() { psql "$U" -XAtc "select count(*) from public.content_items where course_id='ed170000-0000-4000-8000-0000000000c1'"; }
psql "$U" -v ON_ERROR_STOP=1 -Xq -c "insert into auth.users (id, email, raw_user_meta_data) values
 ('$OWNER','le-owner-0a1b2c3d@local.test','{}'), ('$OTHER','le-other-0a1b2c3d@local.test','{}'), ('$STUDENT','le-student-0a1b2c3d@local.test','{}')" >/dev/null || die "persona users"
out=$(pre); [ $? -ne 0 ] && grep -q "le-\* persona(s) already exist" <<<"$out"; say "P1a preflight refuses a stack that already has le-* personas (fresh-stack rule)" $?
out=$(apply "" "$OWNER"); st=$?; obs n items && [ $st -ne 0 ] && grep -q "apply it only through" <<<"$out" && [ "$n" = 0 ]; say "G1 fixture without the run.sh acknowledgement is refused and writes nothing" $?
out=$(apply "$ACK" "22222222-2222-4222-8222-000000000009"); st=$?; obs n items && [ $st -ne 0 ] && grep -q "is not an le-\* local.test account" <<<"$out" && [ "$n" = 0 ]; say "G2 a non-persona OWNER id is refused and writes nothing" $?
psql "$U" -Xqc "insert into auth.users (id, email, raw_user_meta_data) values ('33333333-3333-4333-8333-000000000001','someone@example.com','{}')" >/dev/null
out=$(apply "$ACK" "$OWNER"); st=$?; obs n items && [ $st -ne 0 ] && grep -q "non-synthetic auth user" <<<"$out" && [ "$n" = 0 ]; say "G3 a non-synthetic auth user makes the fixture refuse" $?
out=$(pre); [ $? -ne 0 ] && grep -q "non-synthetic account" <<<"$out"; say "P1b preflight refuses the same non-synthetic account" $?
X=33333333-3333-4333-8333-000000000001   # added by G3 only; removed again (separate statements, so one failure cannot mask another)
psql "$U" -Xq -c "delete from public.notifications where user_id='$X'" -c "delete from public.user_roles where user_id='$X'" \
  -c "delete from public.profiles where id='$X'" -c "delete from auth.users where id='$X'" >/dev/null 2>&1
obs n psql "$U" -XAtc "select count(*) from auth.users where id='$X'" && [ "$n" = 0 ] || die "could not remove the G3 account"
out=$(apply "$ACK" "$OWNER"); st=$?; obs n items && [ $st -eq 0 ] && grep -q "PASS le-fixture" <<<"$out" && [ "$n" = 6 ]; say "G4 fixture applies on the bootstrapped snapshot schema (6 items, N and KN NULL, quiz + 2 questions)" $?
out=$(apply "$ACK" "$OWNER"); st=$?; obs n items && [ $st -ne 0 ] && grep -q "already exists" <<<"$out" && [ "$n" = 6 ]; say "G5 a second apply is refused (once per fresh stack, never reset)" $?
q=$(psql "$U" -XAtc "select count(*) from net.http_request_queue"); e=$(psql "$U" -XAtc "select count(*) from local_evidence.egress_attempts")
[ "$q" = 0 ] && [ "$e" = 0 ]; say "G6 personas + fixture enqueued nothing for pg_net (queue 0, guard evidence 0)" $?

case "${LE_ST_CONTROL:-}" in
  '') ;;
  no-trigger) psql "$U" -Xqc "drop trigger update_content_items_updated_at on public.content_items" >/dev/null; echo "CONTROL no-trigger: version trigger dropped on $DBNAME" ;;
  no-rls) psql "$U" -Xqc "alter table public.content_items disable row level security" >/dev/null; echo "CONTROL no-rls: RLS disabled on $DBNAME" ;;
  *) echo "unknown LE_ST_CONTROL"; exit 2 ;;
esac

# ---------- SQL-level contract under the snapshot RLS, as role authenticated with the persona's claims ----------
as() { # persona-id, sql -> last output line; the producer's own status is kept (no pipe masks it)
  local o; o=$(psql "$U" -X -qAt -v ON_ERROR_STOP=1 -c "set role authenticated" \
    -c "select set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', false)" -c "$2" 2>/dev/null) || return 1
  printf '%s\n' "${o##*$'\n'}"
}
upd() { echo "with u as (update public.content_items set title = '$3', updated_at = '2001-01-01T00:00:00Z' where id = '$1' and $2 returning 1) select count(*) from u"; }
ver() { psql "$U" -XAtc "select updated_at from public.content_items where id='$1'"; }
K1=ed170000-0000-4000-8000-0000000000b1; KN=ed170000-0000-4000-8000-0000000000b2
obs v0 ver $K1 && [ -n "$v0" ]; say "S0 producer: K has a version" $?
obs n as "$OWNER" "$(upd $K1 "updated_at = '$v0'" 'K1')" && [ "$n" = 1 ]; say "S1 OWNER conditional write on the current version changes 1 row" $?
obs v1 ver $K1 && obs t psql "$U" -XAtc "select updated_at <> '2001-01-01T00:00:00Z'::timestamptz from public.content_items where id='$K1'" && [ -n "$v1" ] && [ "$v1" != "$v0" ] && [ "$t" = t ]; say "S2 the BEFORE UPDATE trigger replaced the client updated_at and advanced the version" $?
obs n as "$OWNER" "$(upd $K1 "updated_at = '$v0'" 'stale')" && [ "$n" = 0 ]; say "S3 a stale version changes 0 rows" $?
obs n as "$OWNER" "$(upd $KN "updated_at is null" 'KN1')" && [ "$n" = 1 ]; say "S4 IS NULL write on a NULL version changes 1 row" $?
obs n as "$OWNER" "$(upd $KN "updated_at is null" 'KN late')" && obs t psql "$U" -XAtc "select title from public.content_items where id='$KN'" && [ "$n" = 0 ] && [ "$t" = KN1 ]; say "S5 a second IS NULL write changes 0 rows (fence)" $?
obs v ver $K1 && obs n as "$OTHER" "$(upd $K1 "updated_at = '$v'" 'other')" && [ "$n" = 0 ]; say "S6 OTHER instructor with the exact version changes 0 rows (RLS)" $?
obs v ver $K1 && obs n as "$STUDENT" "$(upd $K1 "updated_at = '$v'" 'student')" && [ "$n" = 0 ]; say "S7 STUDENT with the exact version changes 0 rows (RLS)" $?
obs t psql "$U" -XAtc "select title from public.content_items where id='$K1'" && [ "$t" = K1 ]; say "S8 K unchanged after denied writes" $?

# ---------- runner ----------
out=$("$HERE/run.sh" read "postgresql://postgres@db.example.com:5432/postgres" ed170000-0000-4000-8000-0000000000a1 2>&1); [ $? -ne 0 ] && grep -q "not loopback" <<<"$out"; say "R1 run.sh refuses a non-loopback DSN" $?
out=$("$HERE/run.sh" read "$U" 660e8400-e29b-41d4-a716-446655440001 2>&1); [ $? -ne 0 ] && grep -q "only fixture ids" <<<"$out"; say "R2 run.sh read refuses a non-fixture id" $?
obs row "$HERE/run.sh" read "$U" ed170000-0000-4000-8000-0000000000a1 && node -e 'const r=JSON.parse(process.argv[1]); process.exit(r && r.type==="page" && r.title==="Lesson A" ? 0 : 1)' "$row"; say "R3 run.sh read returns the fixture row" $?
obs row "$HERE/run.sh" read "$U" ed170000-0000-4000-8000-0000000000ff && [ "$row" = null ]; say "R4 run.sh read of an absent fixture id returns null" $?
W="$SCR/private"; mkdir -m 700 "$W"; printf '{"OWNER":{"id":"%s"},"OTHER":{"id":"%s"}}' "$OWNER" "$OTHER" > "$W/personas.json"
"$HERE/run.sh" owner "$U" "$W" OTHER >/dev/null 2>&1 && obs t psql "$U" -XAtc "select instructor_id from public.courses where id='ed170000-0000-4000-8000-0000000000c1'" && [ "$t" = "$OTHER" ]; say "R5 run.sh owner OTHER moves only C1" $?
obs n as "$OWNER" "$(upd ed170000-0000-4000-8000-0000000000a1 "true" 'after move')" && [ "$n" = 0 ]; say "R6 after the move OWNER writes 0 rows (RLS-ZERO-ROW condition)" $?
"$HERE/run.sh" owner "$U" "$W" OWNER >/dev/null 2>&1 && obs t psql "$U" -XAtc "select instructor_id from public.courses where id='ed170000-0000-4000-8000-0000000000c1'" && [ "$t" = "$OWNER" ]; say "R7 run.sh owner OWNER restores C1" $?
obs h1 "$HERE/run.sh" quizhash "$U" && obs h2 "$HERE/run.sh" quizhash "$U" && [[ "$h1" =~ ^[0-9a-f]{32}$ ]] && [ "$h1" = "$h2" ]; say "R8 quizhash is stable, well-formed and read-only" $?
touch "$W/stray.txt"; out=$("$HERE/run.sh" cleanup "$W" 2>&1); [ $? -ne 0 ] && [ -e "$W/personas.json" ]; say "R9 cleanup refuses a private dir with unexpected files and removes nothing" $?
rm -f "$W/stray.txt"; "$HERE/run.sh" cleanup "$W" >/dev/null 2>&1 && [ ! -e "$W" ]; say "R10 cleanup removes the private session dir" $?
E="$SCR/evidence"; mkdir -m 700 "$E"; echo '{"tier":"LOCAL","checks":[]}' > "$E/backend-contract.json"
out=$("$HERE/run.sh" evidence "$SCR/staged1" "$E" 2>&1); [ $? -eq 0 ] && [ -f "$SCR/staged1/MANIFEST.sha256" ]; say "R11 evidence staging (T-09 stage-evidence) stages a clean evidence dir with a manifest" $?
printf 'x eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl y' > "$E/leak.txt"
out=$("$HERE/run.sh" evidence "$SCR/staged2" "$E" 2>&1); [ $? -ne 0 ] && [ ! -e "$SCR/staged2" ] && ! grep -q "eyJhbGci" <<<"$out"; say "R12 evidence staging refuses a JWT-shaped file and never prints it" $?
rm -f "$E/leak.txt"; echo '{}' > "$E/state-OWNER.json"
out=$("$HERE/run.sh" evidence "$SCR/staged3" "$E" 2>&1); [ $? -ne 0 ] && [ ! -e "$SCR/staged3" ]; say "R13 evidence staging refuses a session file under the evidence dir" $?

# ---------- FAKE psql negatives (no database side effect) and output sanitization ----------
FB="$SCR/fakebin"; mkdir "$FB"
MARK="LEAKMARK_$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
cat > "$FB/psql" <<EOF
#!/usr/bin/env bash
case "\${FAKE_PSQL:-fail}" in
  fail) echo "psql: error: connection to postgresql://u:$MARK@127.0.0.1:$PORT/x failed $MARK" >&2; exit 2 ;;
  two)  echo 2 ;;
  junk) echo "$MARK not json" ;;
esac
EOF
chmod +x "$FB/psql"
before=$(psql "$U" -XAtc "select md5(string_agg(row_to_json(c)::text, '' order by id)) from public.content_items c")
out=$(PATH="$FB:$PATH" FAKE_PSQL=fail "$HERE/run.sh" read "$U" ed170000-0000-4000-8000-0000000000a1 2>&1); st=$?
[ $st -ne 0 ] && ! grep -q "$MARK" <<<"$out" && grep -q "stderr withheld" <<<"$out"; say "F1 a failing psql fails read closed; its stderr (DSN, marker) is never printed" $?
out=$(PATH="$FB:$PATH" FAKE_PSQL=junk "$HERE/run.sh" read "$U" ed170000-0000-4000-8000-0000000000a1 2>&1); [ $? -ne 0 ] && ! grep -q "$MARK" <<<"$out"; say "F2 non-JSON psql output fails read closed and is not echoed" $?
out=$(PATH="$FB:$PATH" FAKE_PSQL=junk "$HERE/run.sh" quizhash "$U" 2>&1); [ $? -ne 0 ] && ! grep -q "$MARK" <<<"$out"; say "F3 malformed quizhash output fails closed" $?
mkdir -m 700 "$W"; printf '{"OWNER":{"id":"%s"},"OTHER":{"id":"%s"}}' "$OWNER" "$OTHER" > "$W/personas.json"
out=$(PATH="$FB:$PATH" FAKE_PSQL=two "$HERE/run.sh" owner "$U" "$W" OTHER 2>&1); [ $? -ne 0 ] && grep -q "unexpected number of rows" <<<"$out"; say "F4 an owner change reporting 2 rows is refused" $?
out=$(PATH="$FB:$PATH" FAKE_PSQL=fail pre); [ $? -ne 0 ] && ! grep -q "$MARK" <<<"$out" && grep -q "stderr withheld" <<<"$out"; say "F5 preflight fails closed on a failing psql without printing its stderr" $?
after=$(psql "$U" -XAtc "select md5(string_agg(row_to_json(c)::text, '' order by id)) from public.content_items c")
[ -n "$before" ] && [ "$before" = "$after" ]; say "F6 the fake-psql negatives changed nothing in the database" $?
printf '{"OWNER":' > "$W/broken.json"; chmod 600 "$W/broken.json"
out=$(node "$HERE/backend-contract.mjs" "$API" "$K/anon" "$W/broken.json" "$SCR/c.json" 2>&1); [ $? -ne 0 ] && ! grep -q '{"OWNER"' <<<"$out"; say "F7 a malformed personas file fails the contract without quoting its content" $?
rm -rf "$W"
out=$(node "$HERE/personas.mjs" "$API" "$K/anon" "$K/service" "$APP" "$SCR/partial" 2>&1); st=$?   # the fake refuses the POST
[ $st -ne 0 ] && [ ! -e "$SCR/partial" ] && grep -q "partial private output removed" <<<"$out"; say "F8 a persona-creation failure removes the partial private dir" $?

# ---------- pin is checked FIRST (mirror tree with one changed harness file) ----------
M="$SCR/mirror"; mkdir -p "$M/scripts/local-stack" "$M/scripts/local-db" "$M/scripts/e2e"
cp -r "$ROOT/scripts/local-stack/lesson-editor" "$ROOT/scripts/local-stack/t09" "$M/scripts/local-stack/"
cp "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$M/scripts/local-db/"; cp "$ROOT/scripts/e2e/assert-safe-target.mjs" "$M/scripts/e2e/"
echo "// changed" >> "$M/scripts/local-stack/t09/api-http.mjs"
out=$("$M/scripts/local-stack/lesson-editor/run.sh" setup "https://bad.example" "$APP" "postgresql://x@db.example.com/x" "$K/anon" "$K/service" "$SCR/p2" "$SCR/e2" 2>&1)
[ $? -ne 0 ] && grep -q "not the pinned" <<<"$out" && ! grep -q "origin refused\|not loopback" <<<"$out"; say "R14 the harness pin is checked before any target or helper (changed api-http.mjs refused first)" $?

echo "le guards-selftest: $npass passed, $nfail failed (LOCAL-SIM: PG16 throwaway cluster, simulated managed layout, LOCAL-SHIM queue; FAKE HTTP/psql where labelled; NOT PostgREST/GoTrue/PG15)"
[ $nfail -eq 0 ]
