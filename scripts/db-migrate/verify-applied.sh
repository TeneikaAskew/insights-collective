#!/usr/bin/env bash
# ABOUTME: READ-ONLY reconciliation after an apply whose outcome is unknown (non-zero exit, lost response, runner killed).
# ABOUTME: Decides from the database alone: APPLIED, NOT_APPLIED, INCONSISTENT or UNSETTLED. Never applies, re-runs or rolls back.
# Usage: PGURL=... [WRITER_RUN_TERMINAL=<run id>:<conclusion>] verify-applied.sh <version> [expected file]
#   expected file (default expected/touched-<version>.txt): one "<key> <before-md5> <after-md5>" line per object the reviewed
#   file changes ("absent" when missing), derived locally from the exact reviewed bytes.
#
# Scope (production metadata): the server is asked ONLY about the named keys in the expected file. Functions are filtered by
# public schema + proname list, policies by public schema + table list + name list, triggers by the exact tables and names,
# and the result is restricted to the exact expected keys. Keys are validated against a strict grammar BEFORE any connection,
# so no key can carry SQL. Only md5 values come back; a returned key that is not expected is a read error (42).
#
# Settled barrier (an old snapshot is not a completion barrier for an in-flight commit):
#   1. NOT_APPLIED is reported only when the caller attests that the original writer run is terminal:
#      WRITER_RUN_TERMINAL=<run id>:<success|failure|cancelled|timed_out>. Without it the same reads give UNSETTLED.
#   2. Server-side, BEFORE and AFTER the reads: no other client backend holds or awaits a schema-writer lock (RowExclusive or
#      stronger on pg_proc, pg_policy, pg_trigger, pg_class or the ledger; ShareRowExclusive or stronger on a touched table).
#      Counts only: no query text, user or pid is printed. Any such lock gives UNSETTLED.
#   3. Ledger and objects are read in ONE repeatable-read, read-only transaction (one snapshot); the ledger is then re-read in
#      a fresh snapshot. A difference means a commit landed in between: INCONSISTENT (conservative). The ledger is never
#      edited to make the reads agree.
# Exit: 0 APPLIED, 40 NOT_APPLIED, 41 INCONSISTENT (stop; human decision), 42 usage/read error, 43 UNSETTLED (writer not
# proven terminal, or a schema writer is active: no retry decision may be taken from this run).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; V="${1:-}"; EXP="${2:-$HERE/expected/touched-$V.txt}"
[[ "$V" =~ ^[0-9]{14}$ ]] && [ -s "$EXP" ] && [ -n "${PGURL:-}" ] || { echo "VERIFY REFUSED [42]: usage"; exit 42; }

# ---- expected keys: strict grammar, no duplicates, checked before any connection ----
KEY_RE='^(fn\|[a-z_][a-z0-9_]*\([a-z0-9_,]*\)|policy\|[a-z_][a-z0-9_]*\|[A-Za-z0-9_()]+|trigger\|[a-z_][a-z0-9_]*\|[a-z_][a-z0-9_]*)$'
H_RE='^([0-9a-f]{32}|absent)$'
declare -A WANT=(); FN=(); TB=(); PN=(); TG=()
add() { local -n _a=$1; local x; for x in "${_a[@]}"; do [ "$x" = "$2" ] && return 0; done; _a+=("$2"); }
while read -r key b a extra; do
  [ -z "${key:-}" ] && continue
  [[ "$key" =~ $KEY_RE ]] && [[ "${b:-}" =~ $H_RE ]] && [[ "${a:-}" =~ $H_RE ]] && [ -z "${extra:-}" ] \
    || { echo "VERIFY REFUSED [42]: an expected-file line does not match the key grammar"; exit 42; }
  [ -z "${WANT[$key]:-}" ] || { echo "VERIFY REFUSED [42]: duplicate expected key"; exit 42; }
  WANT[$key]="$b $a"
  IFS='|' read -r kind p1 p2 <<<"$key"
  case $kind in fn) add FN "${p1%%(*}" ;; policy) add TB "$p1"; add PN "$p2" ;; trigger) add TB "$p1"; add TG "$p2" ;; esac
done < "$EXP"
[ "${#WANT[@]}" -gt 0 ] || { echo "VERIFY REFUSED [42]: no expected keys"; exit 42; }
arr() { local s="" x; for x in "$@"; do s="$s,'$x'"; done; echo "array[${s#,}]::text[]"; }   # only grammar-checked values
FNA=$(arr "${FN[@]}"); TBA=$(arr "${TB[@]}"); PNA=$(arr "${PN[@]}"); TGA=$(arr "${TG[@]}"); KEYA=$(arr "${!WANT[@]}")
[ ${#FN[@]} -gt 0 ] || FNA="array[]::text[]"; [ ${#TB[@]} -gt 0 ] || TBA="array[]::text[]"
[ ${#PN[@]} -gt 0 ] || PNA="array[]::text[]"; [ ${#TG[@]} -gt 0 ] || TGA="array[]::text[]"

# ---- writer attestation ----
ATTEST="${WRITER_RUN_TERMINAL:-}"; ATTESTED=0
if [ -n "$ATTEST" ]; then
  [[ "$ATTEST" =~ ^[0-9]{1,20}:(success|failure|cancelled|timed_out)$ ]] \
    || { echo "VERIFY REFUSED [42]: WRITER_RUN_TERMINAL must be <run id>:<success|failure|cancelled|timed_out>"; exit 42; }
  ATTESTED=1
fi

# ---- server-side reads (every psql session is read-only) ----
WRITERS="select count(*) from pg_locks l join pg_stat_activity s on s.pid = l.pid
 where l.pid <> pg_backend_pid() and s.backend_type = 'client backend' and l.locktype = 'relation' and (
   (l.relation in ('pg_catalog.pg_proc'::regclass, 'pg_catalog.pg_policy'::regclass, 'pg_catalog.pg_trigger'::regclass,
                   'pg_catalog.pg_class'::regclass, 'supabase_migrations.schema_migrations'::regclass)
    and l.mode in ('RowExclusiveLock','ShareLock','ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock'))
   or (l.relation in (select c.oid from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname = any($TBA))
    and l.mode in ('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')))"
LEDGER="select count(*) from supabase_migrations.schema_migrations where version = '$V'"
OBJS="select k||' '||h from (
 select 'fn|'||replace(p.oid::regprocedure::text,' ','_') k,
        md5(p.prosrc||'|'||coalesce((select string_agg(a::text,',' order by a::text) from unnest(p.proacl) a),'')) h
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($FNA)
 union all select 'policy|'||tablename||'|'||replace(policyname,' ','_'),
        md5(coalesce(qual,'')||'|'||coalesce(with_check,'')||'|'||cmd||'|'||permissive||'|'||roles::text)
   from pg_policies where schemaname = 'public' and tablename = any($TBA) and replace(policyname,' ','_') = any($PNA)
 union all select 'trigger|'||t.tgrelid::regclass::text||'|'||t.tgname, md5(pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text)
   from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and c.relnamespace = 'public'::regnamespace and c.relname = any($TBA) and t.tgname = any($TGA)
) x where k = any($KEYA)"
# Every session is read-only with a short lock_timeout: definition readers (pg_get_expr, pg_get_triggerdef) take AccessShare on
# the table, and must never queue behind a writer's lock (or make application traffic queue behind them). A lock timeout is
# reported as UNSETTLED, not as a read error and never as a result.
SET_RO="set lock_timeout = '2s'; set statement_timeout = '30s'"
ro() { psql "$PGURL" -X -At -v ON_ERROR_STOP=1 -c "begin transaction read only" -c "$SET_RO" -c "$1" -c "rollback" | grep -E '^[0-9]+$'; }
unsettled_lock() { echo "VERIFY UNSETTLED $V: a read waited on a lock held by another session (lock_timeout); no retry decision from this read; verify again after the writer ends."; exit 43; }

w1=$(ro "$WRITERS") || { echo "VERIFY ERROR [42]: lock state not readable"; exit 42; }
if [ "$w1" != 0 ]; then
  echo "VERIFY UNSETTLED $V: schema-writer locks held or awaited by $w1 lock entries of other client backends; objects not read. Decision: no retry decision from this read; verify again after the writer ends."; exit 43
fi
snap=$(psql "$PGURL" -X -At -v ON_ERROR_STOP=1 -c "begin transaction isolation level repeatable read read only" -c "$SET_RO" \
  -c "select 'L '||($LEDGER)" -c "$OBJS" -c "rollback" 2>"${TMPDIR:-/tmp}/verify-err.$$"); st=$?
if [ $st -ne 0 ]; then grep -q "lock timeout" "${TMPDIR:-/tmp}/verify-err.$$"; lt=$?; rm -f "${TMPDIR:-/tmp}/verify-err.$$"; [ $lt = 0 ] && unsettled_lock; echo "VERIFY ERROR [42]: snapshot read failed"; exit 42; fi
rm -f "${TMPDIR:-/tmp}/verify-err.$$"
led2=$(ro "$LEDGER") || { echo "VERIFY ERROR [42]: ledger re-read failed"; exit 42; }
w2=$(ro "$WRITERS") || { echo "VERIFY ERROR [42]: lock state not readable"; exit 42; }

led=$(printf '%s\n' "$snap" | sed -n 's/^L \([0-9][0-9]*\)$/\1/p'); [ -n "$led" ] || { echo "VERIFY ERROR [42]: ledger not readable"; exit 42; }
cur=$(printf '%s\n' "$snap" | grep -E '^(fn|policy|trigger)\|' || true)
rows=0
while read -r k h; do
  [ -z "${k:-}" ] && continue; rows=$((rows+1))
  [ -n "${WANT[$k]:-}" ] || { echo "VERIFY ERROR [42]: an out-of-scope key was returned"; exit 42; }
done <<<"$cur"
before=0; after=0; other=0; total=0
for key in "${!WANT[@]}"; do
  read -r b a <<<"${WANT[$key]}"; total=$((total+1))
  h=$(printf '%s\n' "$cur" | awk -v k="$key" '$1==k {print $2; exit}'); [ -n "$h" ] || h=absent
  if [ "$h" = "$a" ]; then after=$((after+1)); elif [ "$h" = "$b" ]; then before=$((before+1)); else other=$((other+1)); fi
done
SCOPE="scope $total expected keys, $rows rows returned"

if [ "$w1" != 0 ] || [ "$w2" != 0 ]; then
  echo "VERIFY UNSETTLED $V: schema-writer locks held or awaited by other client backends (before $w1, after $w2); $SCOPE. Decision: no retry decision from this read; verify again after the writer ends."; exit 43
fi
if [ "$led" != "$led2" ]; then
  echo "VERIFY INCONSISTENT $V: ledger changed between snapshots ($led -> $led2), a commit landed during verification; $SCOPE. Decision: STOP. No ledger edit; verify again once settled, reviewer decides."; exit 41
fi
if [ "$led" = 1 ] && [ $after = $total ]; then
  echo "VERIFY APPLIED $V: ledger 1, $after/$total touched objects at the reviewed NEW state, one snapshot, no writer active; $SCOPE. Decision: do NOT re-run; continue with the next version."; exit 0
fi
if [ "$led" = 0 ] && [ $before = $total ]; then
  if [ $ATTESTED = 0 ]; then
    echo "VERIFY UNSETTLED $V: reads show nothing committed, but the original writer run is not attested terminal (WRITER_RUN_TERMINAL unset); $SCOPE. Decision: no retry decision."; exit 43
  fi
  echo "VERIFY NOT_APPLIED $V: ledger 0, $before/$total touched objects at the reviewed OLD state; writer run $ATTEST attested terminal; no writer active before or after; $SCOPE. Decision: nothing committed; a re-dispatch of the same file needs reviewer sign-off, never blind."; exit 40
fi
echo "VERIFY INCONSISTENT $V: ledger $led, objects old $before / new $after / other $other of $total; $SCOPE. Decision: STOP. No rollback, re-run or ledger edit; escalate to the reviewer."; exit 41
