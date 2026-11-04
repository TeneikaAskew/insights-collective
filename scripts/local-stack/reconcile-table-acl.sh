#!/usr/bin/env bash
# ABOUTME: Makes the table privileges of anon/authenticated/service_role on public relations EXACTLY the
# ABOUTME: privileges captured in the snapshot's grant file: anything else (e.g. the Supabase image's default
# ABOUTME: privileges, which grant anon ALL on every new public table) is revoked privilege by privilege, then
# ABOUTME: re-read. Fails closed on an unparseable grant line, a residual extra, or a captured grant that is missing.
# Usage: reconcile-table-acl.sh <loopback DSN> <05_triggers_grants.sql> [broken-live relation,...]
# Positive-only replay (GRANT lines alone) preserves whatever defaults the server added; this is the exact
# reconciliation instead. It is NOT a global revoke: only (relation, role, privilege) triples that exist on the
# server and are absent from the capture are touched, only for the three API roles the capture covers.
# The capture is parsed and validated in bash alone (no sed/awk/sort/grep pipeline whose failure could be masked),
# and psql is not started unless the whole capture parsed, is non-empty and every element is validated.
set -u
PGURL="${1:?loopback DSN}"; GRANTS="${2:?grant file}"; BROKEN="${3:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGURL" >/dev/null || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
die() { echo "ACL reconcile: refusing before any database call: $*" >&2; exit 2; }
[ -f "$GRANTS" ] && [ -r "$GRANTS" ] && [ -s "$GRANTS" ] || die "grant file missing, unreadable or empty: $GRANTS"
[[ "$BROKEN" =~ ^([a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*)?$ ]] || die "broken-live list is not a comma list of identifiers"
mapfile -t LINES < "$GRANTS" || die "cannot read $GRANTS"
[ "${#LINES[@]}" -gt 0 ] || die "no lines read from $GRANTS"
STRICT='^grant ([A-Z]+(, [A-Z]+)*) on public\.([a-z_][a-z0-9_]*) to (anon|authenticated|service_role);$'
PRIV_OK='^(SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)$'
declare -A CAP=(); n_grant_lines=0; bad=()
for line in "${LINES[@]}"; do
  [[ "$line" == grant\ * ]] || continue
  n_grant_lines=$((n_grant_lines+1))
  if [[ "$line" =~ $STRICT ]]; then
    privs="${BASH_REMATCH[1]}"; rel="${BASH_REMATCH[3]}"; role="${BASH_REMATCH[4]}"
    IFS=',' read -r -a parts <<< "${privs//, /,}"
    [ "${#parts[@]}" -gt 0 ] || bad+=("$line")
    for p in "${parts[@]}"; do [[ "$p" =~ $PRIV_OK ]] || { bad+=("$line"); continue; }; CAP["$rel"$'\t'"$role"$'\t'"$p"]=1; done
  else
    bad+=("$line")
  fi
done
[ "${#bad[@]}" -eq 0 ] || { printf '   %s\n' "${bad[@]:0:5}" | cut -c1-200 >&2; die "${#bad[@]} table grant line(s) do not match the strict form"; }
[ "$n_grant_lines" -gt 0 ] || die "no table grant lines in $GRANTS"
[ "${#CAP[@]}" -ge "$n_grant_lines" ] || die "captured ${#CAP[@]} privileges from $n_grant_lines grant lines (expected at least one per line)"
# Expected-capture payload, built in memory and validated element by element before psql starts.
PAYLOAD=""; n_rel=0; declare -A RELS=()
for k in "${!CAP[@]}"; do
  [[ "$k" =~ ^[a-z_][a-z0-9_]*$'\t'(anon|authenticated|service_role)$'\t'(SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)$ ]] || die "invalid capture element: $k"
  PAYLOAD+="$k"$'\n'; RELS["${k%%$'\t'*}"]=1
done
n_rel=${#RELS[@]}; [ "$n_rel" -gt 0 ] && [ -n "$PAYLOAD" ] || die "empty capture"
OUT=$(psql "$PGURL" -Atq -v ON_ERROR_STOP=1 -v broken="$BROKEN" 2>&1 <<SQL
create temp table cap(rel text, role text, priv text);
copy cap from stdin;
${PAYLOAD}\.
do \$\$ begin if (select count(*) from cap) <> ${#CAP[@]} then raise exception 'capture rows loaded % <> expected ${#CAP[@]}', (select count(*) from cap); end if; end \$\$;
create temp table broken(rel text);
insert into broken select unnest(string_to_array(nullif(:'broken', ''), ','));
create temp view actual as
  select c.relname::text rel, g.rolname::text role, a.privilege_type::text priv, a.grantor::regrole::text grantor
  from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl) a
  join pg_roles g on g.oid=a.grantee
  where n.nspname='public' and c.relkind in ('r','v','m','p','f') and g.rolname in ('anon','authenticated','service_role');
create temp table extra as select distinct a.rel, a.role, a.priv, a.grantor from actual a
  where not exists (select 1 from cap k where k.rel=a.rel and k.role=a.role and k.priv=a.priv);
do \$\$ declare r record; begin
  for r in select distinct rel, role, priv from extra order by 1,2,3 loop
    execute format('revoke %s on public.%I from %I', r.priv, r.rel, r.role);
  end loop; end \$\$;
select 'REVOKED' || E'\t' || rel || E'\t' || role || E'\t' || string_agg(priv, ',' order by priv) || E'\t' || min(grantor)
  from extra group by rel, role order by rel, role;
select 'RESIDUAL' || E'\t' || a.rel || E'\t' || a.role || E'\t' || a.priv || E'\t' || a.grantor from actual a
  where not exists (select 1 from cap k where k.rel=a.rel and k.role=a.role and k.priv=a.priv) order by 1;
select 'MISSING' || E'\t' || k.rel || E'\t' || k.role || E'\t' || k.priv from cap k
  where k.rel not in (select rel from broken)
    and not exists (select 1 from actual a where a.rel=k.rel and a.role=k.role and a.priv=k.priv) order by 1;
select 'END';
SQL
); st=$?
if [ $st -ne 0 ]; then echo "ACL reconcile: psql exit $st: $(printf '%s' "$OUT" | head -c 300)" >&2; exit 2; fi
[[ "$OUT" == *$'\n'END || "$OUT" == END ]] || { echo "ACL reconcile: incomplete psql output (no END marker)" >&2; exit 2; }
nrev=0; nres=0; nmis=0; shown=0
while IFS= read -r l; do
  case "$l" in
    REVOKED$'\t'*) nrev=$((nrev+1)); [ $shown -lt 20 ] && { echo "   revoked (not in capture): ${l#REVOKED$'\t'}"; shown=$((shown+1)); } ;;
    RESIDUAL$'\t'*) nres=$((nres+1)); echo "   $l" ;;
    MISSING$'\t'*) nmis=$((nmis+1)); echo "   $l" ;;
  esac
done <<< "$OUT"
[ "$nrev" -gt 20 ] && echo "   ... $((nrev-20)) more"
echo "ACL reconcile: captured ${#CAP[@]} privileges on $n_rel relations from $n_grant_lines grant lines; revoked extras on $nrev (relation, role) pair(s); residual $nres; missing $nmis"
if [ "$nres" -ne 0 ] || [ "$nmis" -ne 0 ]; then echo "ACL reconcile FAILED: privileges still differ from the capture" >&2; exit 1; fi
