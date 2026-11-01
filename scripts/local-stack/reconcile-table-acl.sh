#!/usr/bin/env bash
# ABOUTME: Makes the table privileges of anon/authenticated/service_role on public relations EXACTLY the
# ABOUTME: privileges captured in the snapshot's grant file: anything else (e.g. the Supabase image's default
# ABOUTME: privileges, which grant anon ALL on every new public table) is revoked privilege by privilege, then
# ABOUTME: re-read. Fails closed on an unparseable grant line, a residual extra, or a captured grant that is missing.
# Usage: reconcile-table-acl.sh <loopback DSN> <05_triggers_grants.sql> [broken-live relation,...]
# Positive-only replay (GRANT lines alone) preserves whatever defaults the server added; this is the exact
# reconciliation instead. It is NOT a global revoke: only (relation, role, privilege) triples that exist on the
# server and are absent from the capture are touched, only for the three API roles the capture covers.
set -u
PGURL="${1:?loopback DSN}"; GRANTS="${2:?grant file}"; BROKEN="${3:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGURL" >/dev/null || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
[ -f "$GRANTS" ] && [ -r "$GRANTS" ] && [ -s "$GRANTS" ] || { echo "ACL reconcile: grant file missing, unreadable or empty: $GRANTS" >&2; exit 2; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
STRICT='^grant ([A-Z]+(, [A-Z]+)*) on public\.([a-z_][a-z0-9_]*) to (anon|authenticated|service_role);$'
grep -E '^grant ' "$GRANTS" > "$T/all" || : ; grep -E "$STRICT" "$T/all" > "$T/ok" || :
if [ "$(wc -l < "$T/all")" != "$(wc -l < "$T/ok")" ] || [ ! -s "$T/ok" ]; then
  echo "ACL reconcile: refusing, $(($(wc -l < "$T/all") - $(wc -l < "$T/ok"))) table grant line(s) do not match the strict form (or none parsed):" >&2
  grep -v -E "$STRICT" "$T/all" | head -5 | cut -c1-200 >&2; exit 2
fi
sed -E "s/$STRICT/\3\t\4\t\1/" "$T/ok" | awk -F'\t' '{n=split($3,p,", "); for(i=1;i<=n;i++) print $1"\t"$2"\t"p[i]}' | sort -u > "$T/captured.tsv"
{ cat <<'SQL'
\set ON_ERROR_STOP 1
create temp table cap(rel text, role text, priv text);
copy cap from stdin;
SQL
cat "$T/captured.tsv"; printf '%s\n' '\.'
cat <<SQL
create temp table broken(rel text);
insert into broken select unnest(string_to_array(nullif('${BROKEN//\'/}', ''), ','));
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
SQL
} | psql "$PGURL" -Atq > "$T/out" 2> "$T/err"; st=$?
if [ $st -ne 0 ]; then echo "ACL reconcile: psql exit $st: $(head -c 300 "$T/err")" >&2; exit 2; fi
nrev=$(grep -c '^REVOKED' "$T/out"); nres=$(grep -c '^RESIDUAL' "$T/out"); nmis=$(grep -c '^MISSING' "$T/out")
echo "ACL reconcile: captured $(wc -l < "$T/captured.tsv") privileges on $(cut -f1 "$T/captured.tsv" | sort -u | wc -l) relations; revoked extras on $nrev (relation, role) pair(s); residual $nres; missing $nmis"
grep '^REVOKED' "$T/out" | head -20 | sed 's/^REVOKED\t/   revoked (not in capture): /'
[ "$nrev" -gt 20 ] && echo "   ... $((nrev-20)) more"
if [ "$nres" -ne 0 ] || [ "$nmis" -ne 0 ]; then
  grep -E '^(RESIDUAL|MISSING)' "$T/out" | head -20 | sed 's/^/   /'
  echo "ACL reconcile FAILED: privileges still differ from the capture" >&2; exit 1
fi
