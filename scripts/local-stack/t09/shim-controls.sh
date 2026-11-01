#!/usr/bin/env bash
# ABOUTME: LOCAL-SHIM controls for the pg_net egress guard on a plain local PostgreSQL: sentinels that must be intercepted
# ABOUTME: and negative controls that must make the guard or verifier fail. Says nothing about authentic installed pg_net.
# Usage: shim-controls.sh <loopback base url ending in /postgres> <template db with the 9cd162f schema replayed>
# Every result line is "PASS <id> ..." or "FAIL <id> ..."; any FAIL exits 1. Each control runs on its own fresh clone.
# DISPOSABLE LOCAL-SHIM ONLY: it drops and recreates databases named t09c_*, and the ORIGIN controls create local
# roles t09_* and a cluster-wide parameter grant that is revoked on exit. Never point it at an existing or shared stack.
set -u
BASE="${1:?loopback url to the maintenance db, e.g. postgresql://postgres@127.0.0.1:54329/postgres}"; TEMPLATE="${2:?template db}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$BASE" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
URL_PREFIX="${BASE%/*}"; PH='http://127.0.0.1:1/local-placeholder'; RC=0
pass() { echo "PASS $*"; }; fail() { echo "FAIL $*"; RC=1; }
q() { psql "$URL_PREFIX/$1" -v ON_ERROR_STOP=1 -qAtc "$2"; }
fresh() { # name -> clone of TEMPLATE with the queue shim and the frozen vault placeholders
  psql "$BASE" -qc "drop database if exists $1" -qc "create database $1 template $TEMPLATE" >/dev/null || exit 2
  psql "$URL_PREFIX/$1" -v ON_ERROR_STOP=1 -q -f "$HERE/pgnet-queue-shim.sql" >/dev/null || exit 2
  q "$1" "delete from vault.secrets; select count(*) from (select vault.create_secret('$PH', n) from unnest(array['coursera_refresh_secret','coursera_refresh_url','notification_digest_url','notification_email_secret','notification_email_url']) n) x" >/dev/null
}
guard() { psql "$URL_PREFIX/$1" -v allow_shim="${2:-1}" -q -f "$HERE/egress-guard.sql" 2>&1; }
verify() { psql "$URL_PREFIX/$1" -v allow_shim=1 -q -f "$HERE/egress-verify.sql" 2>&1; }
expect_fail() { # id, output, exit status, required message fragment
  if [ "$3" -ne 0 ] && grep -q -- "$4" <<<"$2"; then pass "$1 failed closed: $4"; else fail "$1 expected failure containing '$4' (exit $3): $(tail -2 <<<"$2" | tr '\n' ' ')"; fi
}
echo "== LOCAL-SHIM controls (plain PostgreSQL $(psql "$BASE" -Atc 'show server_version'), template $TEMPLATE). Not pg_net acceptance."

# C0: without allow_shim the guard refuses the shim, as it would in CI.
fresh t09c_c0; out=$(guard t09c_c0 0); expect_fail C0-no-allow-shim "$out" $? 'pg_net extension is not installed'

# C1: UNGUARDED control. The queue really is the delivery path: a call leaves a row a worker would send.
fresh t09c_c1; id=$(q t09c_c1 "select net.http_post('$PH')"); n=$(q t09c_c1 "select count(*) from net.http_request_queue")
[ -n "$id" ] && [ "$n" = 1 ] && pass "C1-unguarded-enqueues id=$id queue=1" || fail "C1-unguarded-enqueues id=$id queue=$n"
# C2: a queue that is not empty at install fails the guard.
out=$(guard t09c_c1); expect_fail C2-nonempty-queue-at-install "$out" $? 'not empty at install'

# G: the guarded stack.
fresh t09c_g; out=$(guard t09c_g); st=$?
[ $st -eq 0 ] && pass "G-install $(grep -o 'egress-guard installed.*' <<<"$out")" || { fail "G-install exit $st: $out"; exit 1; }
out=$(verify t09c_g); [ $? -eq 0 ] && pass "G-verify-after-install $(grep -o 'egress-verify OK.*' <<<"$out")" || fail "G-verify-after-install: $out"

out=$(psql "$URL_PREFIX/t09c_g" -q -f "$HERE/egress-verify.sql" 2>&1); expect_fail G-verify-refuses-shim-without-allow "$out" $? 'local shim marker present but shim mode is off'

# S1: committed sentinels through every public entry point and several roles; queue must stay empty.
q t09c_g "select set_config('t09.stack_label','sentinel',false); select net.http_post('$PH'), net.http_get('$PH'), net.http_delete('$PH')" >/dev/null
for r in service_role authenticated anon; do
  q t09c_g "set role $r; select net.http_post('$PH')" >/dev/null || fail "S1-role-$r call denied (shim grants mirror Supabase)"
done
q t09c_g "set role service_role; insert into net.http_request_queue (method, url, headers, timeout_milliseconds) values ('POST', '$PH', '{}', 1)" >/dev/null
got=$(q t09c_g "select count(*) filter (where dest_class='local-placeholder'), count(*) filter (where dest_class='other'), (select count(*) from net.http_request_queue), string_agg(distinct coalesce(set_role,'none'), ',' order by coalesce(set_role,'none')) from local_evidence.egress_attempts")
[ "$got" = "7|0|0|anon,authenticated,none,service_role" ] && pass "S1-sentinels placeholder=7 other=0 queue=0 roles=anon,authenticated,none,service_role" || fail "S1-sentinels got $got"
ret=$(q t09c_g "select coalesce(net.http_post('$PH')::text, 'NULL')"); [ "$ret" = NULL ] && pass "S1-request-id-is-NULL (callers that wait on the id get nothing)" || fail "S1-request-id $ret"

# S2: an exception-swallowing caller still leaves its evidence (the guard returns NULL, it does not raise).
q t09c_g "do \$\$ begin begin perform net.http_post('$PH'); perform 1/0; exception when others then null; end; end \$\$" >/dev/null
# The inner block rolled back to its implicit savepoint, so the 1/0 erased the evidence too; run the true swallow shape:
q t09c_g "do \$\$ begin begin perform net.http_post('$PH'); exception when others then null; end; end \$\$" >/dev/null
n=$(q t09c_g "select count(*) from local_evidence.egress_attempts")
[ "$n" = 9 ] && pass "S2-swallowing-caller evidence +1 (and a swallowed error AFTER the call erases it: transactional)" || fail "S2 count $n (expected 9)"

# S3: rolled-back SQL erases its own evidence row; persisted counts never cover every attempt.
got=$(psql "$URL_PREFIX/t09c_g" -qAt -c "begin" -c "select net.http_get('https://sentinel.invalid/')" -c "select count(*) from local_evidence.egress_attempts where dest_class='other'" -c "select count(*) from net.http_request_queue" -c "rollback" | tr '\n' '|')
after=$(q t09c_g "select count(*) from local_evidence.egress_attempts where dest_class='other'")
[ "$got" = "|1|0|" ] && [ "$after" = 0 ] && pass "S3-rollback in-tx other=1 queue=0, after rollback other=0" || fail "S3 in-tx '$got' after '$after'"

# S4: replica mode (superuser-only) still intercepted when the guard could set ENABLE ALWAYS.
mode=$(q t09c_g "select v from local_evidence.guard_identity where k='trigger_enabled'")
got=$(psql "$URL_PREFIX/t09c_g" -qAt -c "set session_replication_role = replica" -c "select net.http_post('$PH')" -c "select count(*) from net.http_request_queue")
[ "$mode" = A ] && [ "$(tail -1 <<<"$got")" = 0 ] && pass "S4-replica-mode intercepted (trigger mode A, local owner)" || fail "S4 mode=$mode queue=$(tail -1 <<<"$got")"
out=$(verify t09c_g); [ $? -eq 0 ] && pass "G-verify-after-sentinels" || fail "G-verify-after-sentinels: $out"

# Negative controls: each tampering must make the verifier fail.
neg() { # id, sql, required fragment
  psql "$BASE" -qc "drop database if exists t09c_n" -qc "create database t09c_n template t09c_g" >/dev/null
  q t09c_n "$2" >/dev/null 2>&1 || { fail "$1 setup failed"; return; }
  out=$(verify t09c_n); expect_fail "$1" "$out" $? "$3"
}
neg N1-trigger-disabled "alter table net.http_request_queue disable trigger t09_drop_http_request" 'missing or disabled'
neg N2-function-replaced "create or replace function local_evidence.drop_http_request() returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as \$f\$ begin return new; end \$f\$" 'guard function changed'
neg N3-extra-trigger "create function public.t09_noop() returns trigger language plpgsql as \$f\$ begin return new; end \$f\$; create trigger aaa_first before insert on net.http_request_queue for each row execute function public.t09_noop()" 'triggers on net.http_request_queue'
neg N4-queue-row-present "alter table net.http_request_queue disable trigger t09_drop_http_request; insert into net.http_request_queue (method,url,headers,timeout_milliseconds) values ('GET','$PH','{}',1); alter table net.http_request_queue enable always trigger t09_drop_http_request" 'is not empty'
neg N5-other-destination "select net.http_get('https://sentinel.invalid/')" 'non-placeholder destination'
neg N6-vault-missing "delete from vault.secrets where name='notification_email_url'" 'present 0 times'
neg N7-vault-wrong-value "update vault.secrets set secret='https://example.invalid/' where name='coursera_refresh_url'" 'not the local placeholder'
neg N8-vault-extra-name "select vault.create_secret('$PH','unexpected_name')" 'outside the frozen set'
neg N9-vault-null-value "alter table vault.secrets alter column secret drop not null; update vault.secrets set secret=null where name='notification_digest_url'" 'NULL or not the local placeholder'
neg N10-cron-job "select cron.schedule('t09-control','* * * * *','select 1')" 'cron.job has 1 job'
neg N11-new-vault-reader "create function public.t09_reader() returns text language sql as \$f\$ select decrypted_secret from vault.decrypted_secrets limit 1 \$f\$" 'differ from the frozen set'
echo "   N-vault-duplicate: NOT CONSTRUCTIBLE here (vault.secrets.name is UNIQUE in this shim); the count<>1 check covers it if it ever occurs"

neg N13-always-to-origin "alter table net.http_request_queue enable trigger t09_drop_http_request" 'enable mode changed'
neg N14-function-owner-changed "do \$\$ begin if not exists (select 1 from pg_roles where rolname='t09_otherowner') then create role t09_otherowner; end if; end \$\$; alter function local_evidence.drop_http_request() owner to t09_otherowner" 'owner changed'
neg N15-pg-net-identity "update local_evidence.guard_identity set v = 'other' where k = 'pg_net_ext_oid'" 'pg_net identity changed'
neg N16-proof-function-replaced "create or replace function local_evidence.replica_mode_reachable_by(p_roles text[]) returns text language sql as \$f\$ select null::text \$f\$" 'proof function changed'
neg N17-mixed-design "create extension if not exists pg_trgm; update pg_extension set extname = 'pg_net' where extname = 'pg_trgm'" 'mixed design'

# C3: exclusivity is enforced BEFORE install (before any bootstrap write), not only by the verifier afterwards.
fresh t09c_x
q t09c_x "create function public.t09_noop() returns trigger language plpgsql as \$f\$ begin return new; end \$f\$; create trigger zzz_other before insert on net.http_request_queue for each row execute function public.t09_noop()" >/dev/null
out=$(guard t09c_x); expect_fail C3-preexisting-queue-trigger "$out" $? 'other trigger(s) already on net.http_request_queue'

# ORIGIN path: a non-owner with TRIGGER privilege cannot ENABLE ALWAYS. The guard must then prove replica mode is
# unreachable for every executing role, and fail with the exact reason when it is not.
cleanup_origin() { psql "$BASE" -qc "revoke set on parameter session_replication_role from anon" -qc "revoke postgres from service_role" >/dev/null 2>&1; }
trap cleanup_origin EXIT
fresh t09c_o
q t09c_o "do \$\$ begin if not exists (select 1 from pg_roles where rolname='t09_trig') then create role t09_trig login; end if; end \$\$;
  grant usage on schema net to t09_trig; grant select, trigger on net.http_request_queue to t09_trig; grant create on database t09c_o to t09_trig;
  grant usage on schema vault, cron to t09_trig; grant select on vault.decrypted_secrets, cron.job to t09_trig" >/dev/null
TURL="${URL_PREFIX/postgres@/t09_trig@}/t09c_o"
out=$(psql "$TURL" -v allow_shim=1 -q -f "$HERE/egress-guard.sql" 2>&1); expect_fail O1-origin-default-roles "$out" $? 'replica mode is reachable: postgres can act as a superuser'
out=$(psql "$TURL" -v allow_shim=1 -v executing_roles=t09_trig,anon,authenticated,service_role -q -f "$HERE/egress-guard.sql" 2>&1); st=$?
mode=$(q t09c_o "select v from local_evidence.guard_identity where k='trigger_enabled'" 2>/dev/null)
[ $st -eq 0 ] && [ "$mode" = O ] && pass "O2-origin-proved roles=t09_trig,anon,authenticated,service_role mode=O" || fail "O2-origin-proved exit $st mode=$mode: $(tail -2 <<<"$out" | tr '\n' ' ')"
out=$(psql "$TURL" -v allow_shim=1 -q -f "$HERE/egress-verify.sql" 2>&1); [ $? -eq 0 ] && pass "O3-verify-origin-proved" || fail "O3-verify-origin-proved: $(tail -2 <<<"$out" | tr '\n' ' ')"
psql "$BASE" -qc "grant set on parameter session_replication_role to anon" >/dev/null
out=$(psql "$TURL" -v allow_shim=1 -q -f "$HERE/egress-verify.sql" 2>&1); expect_fail O4-parameter-grant "$out" $? 'anon holds SET on session_replication_role'
cleanup_origin
q t09c_o "alter role authenticated in database t09c_o set session_replication_role = replica" >/dev/null
out=$(psql "$TURL" -v allow_shim=1 -q -f "$HERE/egress-verify.sql" 2>&1); expect_fail O5-stored-role-setting "$out" $? 'authenticated has a stored session_replication_role setting'
q t09c_o "alter role authenticated in database t09c_o reset session_replication_role" >/dev/null
q t09c_o "grant postgres to service_role" >/dev/null
out=$(psql "$TURL" -v allow_shim=1 -q -f "$HERE/egress-verify.sql" 2>&1); expect_fail O6-superuser-membership "$out" $? 'service_role can act as a superuser'
q t09c_o "revoke postgres from service_role" >/dev/null

# N12: a role without TRIGGER on the queue gets the exact blocker and nothing is escalated.
fresh t09c_p
q t09c_p "do \$\$ begin if not exists (select 1 from pg_roles where rolname='t09_noprivs') then create role t09_noprivs login; end if; end \$\$; grant usage, create on schema net to t09_noprivs; grant create on database t09c_p to t09_noprivs" >/dev/null
out=$(psql "${URL_PREFIX/postgres@/t09_noprivs@}/t09c_p" -v allow_shim=1 -q -f "$HERE/egress-guard.sql" 2>&1); st=$?
expect_fail N12-no-trigger-privilege "$out" $st 'BLOCKER: role t09_noprivs lacks TRIGGER'

for d in t09c_c0 t09c_c1 t09c_g t09c_n t09c_p t09c_x t09c_o; do psql "$BASE" -qc "drop database if exists $d" >/dev/null; done
echo "== LOCAL-SHIM controls: $([ $RC -eq 0 ] && echo ALL PASS || echo FAILURES)"; exit $RC
