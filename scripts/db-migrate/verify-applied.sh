#!/usr/bin/env bash
# ABOUTME: READ-ONLY reconciliation after an apply whose outcome is unknown (non-zero exit, lost response, runner killed).
# ABOUTME: Decides from the database alone: APPLIED, NOT_APPLIED or INCONSISTENT. Never applies, re-runs or rolls back.
# Usage: PGURL=... verify-applied.sh <version> [expected file = expected/touched-<version>.txt]
# expected/touched-<version>.txt lists every object the reviewed file changes as "<key> <before-hash> <after-hash>"
# (fingerprints of function body+ACL, policy definition, trigger definition+enabled flag; "absent" when missing), derived
# locally from the exact reviewed bytes. Only md5 values leave the server; no definition text is returned.
# Exit: 0 APPLIED, 40 NOT_APPLIED, 41 INCONSISTENT (stop; human decision), 42 usage/read error.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; V="${1:-}"; EXP="${2:-$HERE/expected/touched-$V.txt}"
[[ "$V" =~ ^[0-9]{14}$ ]] && [ -s "$EXP" ] && [ -n "${PGURL:-}" ] || { echo "VERIFY REFUSED [42]: usage"; exit 42; }
q() { psql "$PGURL" -X -At -v ON_ERROR_STOP=1 -c "begin transaction read only" -c "$1" -c "rollback"; }
led=$(q "select count(*) from supabase_migrations.schema_migrations where version = '$V'" | grep -E '^[0-9]+$') || { echo "VERIFY ERROR [42]: ledger not readable"; exit 42; }
cur=$(q "select 'fn|'||replace(p.oid::regprocedure::text,' ','_')||' '||md5(p.prosrc||'|'||coalesce((select string_agg(a::text,',' order by a::text) from unnest(p.proacl) a),'')) from pg_proc p where p.pronamespace='public'::regnamespace
 union all select 'policy|'||tablename||'|'||replace(policyname,' ','_')||' '||md5(coalesce(qual,'')||'|'||coalesce(with_check,'')||'|'||cmd||'|'||permissive||'|'||roles::text) from pg_policies where schemaname='public'
 union all select 'trigger|'||tgrelid::regclass::text||'|'||tgname||' '||md5(pg_get_triggerdef(oid)||'|'||tgenabled::text) from pg_trigger where not tgisinternal" | grep -E '^(fn|policy|trigger)\|') || { echo "VERIFY ERROR [42]: catalog not readable"; exit 42; }
before=0; after=0; other=0; total=0
while read -r key b a; do
  total=$((total+1)); h=$(printf '%s\n' "$cur" | awk -v k="$key" '$1==k {print $2; exit}'); [ -n "$h" ] || h=absent
  if [ "$h" = "$a" ]; then after=$((after+1)); elif [ "$h" = "$b" ]; then before=$((before+1)); else other=$((other+1)); fi
done < "$EXP"
if [ "$led" = 1 ] && [ $after = $total ]; then echo "VERIFY APPLIED $V: ledger 1, $after/$total touched objects at the reviewed NEW state. Decision: do NOT re-run; continue with the next version."; exit 0; fi
if [ "$led" = 0 ] && [ $before = $total ]; then echo "VERIFY NOT_APPLIED $V: ledger 0, $before/$total touched objects at the reviewed OLD state. Decision: nothing committed; a re-dispatch of the same file needs reviewer sign-off, never blind."; exit 40; fi
echo "VERIFY INCONSISTENT $V: ledger $led, objects old $before / new $after / other $other of $total. Decision: STOP. No rollback, re-run or ledger edit; escalate to the reviewer."; exit 41
