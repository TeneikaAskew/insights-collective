#!/usr/bin/env bash
# ABOUTME: Verifies a bootstrapped local stack object-by-object against the identity manifest and reports
# ABOUTME: declared divergences explicitly. Two manifests: identities.tsv (six kinds, read from the LIVE
# ABOUTME: catalog) and identities-snapshot-derived.tsv (tables, columns, constraints, indexes, views,
# ABOUTME: enums; derived from applying the sanitized DDL, comparison to live UNVERIFIED). Loopback only.
set -u
PGURL="${1:?loopback DSN}"; ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; SNAP="$ROOT/scripts/local-stack/schema"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGURL" >/dev/null || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
emit() { # identity query file -> sorted output; psql status propagated (partial output never counts)
  psql "$PGURL" -Atq -v ON_ERROR_STOP=1 -f "$1" >"$T/raw" 2>"$T/err"; local st=$?
  if [ $st -ne 0 ]; then echo "identity query failed (psql exit $st): $(head -c 300 "$T/err")" >&2; return 1; fi
  sort "$T/raw"
}
emit "$ROOT/scripts/local-db/identities.sql" > "$T/local6" || exit 1
emit "$ROOT/scripts/local-stack/identities-extended.sql" > "$T/localX" || exit 1
sort "$SNAP/identities.tsv" > "$T/live6"
sort "$SNAP/identities-snapshot-derived.tsv" > "$T/snapX" 2>/dev/null || { echo "missing identities-snapshot-derived.tsv" >&2; exit 1; }
sort "$SNAP/DIVERGENCES.tsv" > "$T/div" 2>/dev/null || : > "$T/div"
declared() { awk -F'\t' '{print $1"\t"$2}' "$1" | sort; }
compare() { # label live local
  local label="$1" live="$2" local="$3" rc=0
  declared "$live" > "$T/l.ids"; declared "$local" > "$T/r.ids"
  # identities present on both sides but with different signature, or present on one side only
  join -t $'\t' -j1 <(awk -F'\t' '{print $1"|"$2"\t"$3}' "$live" | sort) <(awk -F'\t' '{print $1"|"$2"\t"$3}' "$local" | sort) | awk -F'\t' '$2!=$3{split($1,a,"|"); print a[1]"\t"a[2]}' > "$T/diffsig"
  comm -23 "$T/l.ids" "$T/r.ids" > "$T/onlylive"; comm -13 "$T/l.ids" "$T/r.ids" > "$T/onlylocal"
  cat "$T/diffsig" "$T/onlylive" | sort -u > "$T/expected_div"
  explained=$(comm -12 "$T/expected_div" "$T/div"); unexplained=$(comm -23 "$T/expected_div" "$T/div")
  [ -n "$explained" ] && { echo "[$label] declared divergences observed (DIVERGENCES.tsv):"; echo "$explained" | sed 's/^/   /'; }
  if [ -n "$unexplained" ] || [ -s "$T/onlylocal" ]; then
    echo "[$label] IDENTITY MISMATCH (server $(psql "$PGURL" -Atc 'show server_version')):"
    [ -n "$unexplained" ] && { echo "  expected but not reproduced / definition differs:"; echo "$unexplained" | sed 's/^/   /' | head -30; }
    [ -s "$T/onlylocal" ] && { echo "  local only:"; sed 's/^/   /' "$T/onlylocal" | head -30; }
    { [ -n "$unexplained" ] && echo "$unexplained"; [ -s "$T/onlylocal" ] && cat "$T/onlylocal"; } | diag
    rc=1
  else
    echo "[$label] OK: $(wc -l < "$T/r.ids") identities match ($(echo "$explained" | grep -c .) declared divergence(s))"
  fi
  return $rc
}
# Catalog evidence is produced by SQL FILES fed to psql with -v ON_ERROR_STOP=1, because psql does not
# interpolate :'var' inside a -c string (the b256e74 form sent a literal :'v' and died with a syntax error).
# Values are catalog text only; no row data.
VIEWFN="$T/viewfn.sql"   # the exact normalization function the signature uses, taken from identities-extended.sql
sed -n '/^create or replace function pg_temp.ic_viewdef_v16form/,/^\$fn\$;$/p' "$ROOT/scripts/local-stack/identities-extended.sql" > "$VIEWFN"
grep -q '^\$fn\$;$' "$VIEWFN" || { echo "could not extract ic_viewdef_v16form from identities-extended.sql" >&2; exit 1; }
cat > "$T/view_evidence.sql" <<'SQL'
\i :viewfn
with v as (
  select c.oid, coalesce(array_to_string(c.reloptions, ','), '') as opts, pg_get_viewdef(c.oid, true) as def,
         (select case when count(distinct d.refobjid) = 1 then (select x.relname::text from pg_class x where x.oid = min(d.refobjid)) end
            from pg_depend d join pg_rewrite r on r.oid = d.objid
           where r.ev_class = c.oid and d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass and d.refobjid <> c.oid) as onerel
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=:'v' and c.relkind='v'
), e(ord, line) as (
  select 1, 'server_version_num: ' || current_setting('server_version_num') from v
  union all select 2, 'reloptions: ' || case when opts = '' then '<none>' else opts end from v
  union all select 3, 'single relation dependency: ' || coalesce(onerel, '<not exactly one>') from v
  union all select 4, E'raw definition (pg_get_viewdef, pretty; first 4000 chars):\n' || left(def, 4000) from v
  union all select 5, 'md5(reloptions|raw definition): ' || md5(opts || '|' || def) from v
  union all select 6, 'md5(reloptions|normalized definition) = identity signature: ' ||
                      md5(opts || '|' || pg_temp.ic_viewdef_v16form(def, onerel, current_setting('server_version_num')::int)) from v
)
select line from e order by ord;
SQL
cat > "$T/acl_evidence.sql" <<'SQL'
select 'owner=' || c.relowner::regrole::text || ' relacl=' || coalesce(c.relacl::text, '<default>')
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=:'r';
SQL
view_evidence() { # view name -> evidence lines; non-zero if psql fails or the view is absent
  local out st
  out=$(psql "$PGURL" -Atq -v ON_ERROR_STOP=1 -v viewfn="$VIEWFN" -v v="$1" -f "$T/view_evidence.sql" </dev/null 2>&1); st=$?
  if [ $st -ne 0 ]; then echo "    evidence query FAILED (psql exit $st): $(echo "$out" | head -c 400)"; return 1; fi
  [ -n "$out" ] || { echo "    view not found in public"; return 1; }
  echo "$out" | sed 's/^/    /'
}
# diag: bounded raw evidence for mismatched views (up to 5) and table grants (up to 10), so a failed run explains
# itself without a rerun.
diag() {
  local kind ident n_v=0 n_g=0 rel out st
  while IFS=$'\t' read -r kind ident; do
    case "$kind" in
      view) n_v=$((n_v+1)); [ $n_v -gt 5 ] && continue
        echo "  diagnostics view $ident:"; view_evidence "$ident" | head -80 ;;
      table_grant) n_g=$((n_g+1)); [ $n_g -gt 10 ] && continue; rel="${ident%%→*}"
        out=$(psql "$PGURL" -At -v ON_ERROR_STOP=1 -v r="$rel" -f "$T/acl_evidence.sql" </dev/null 2>&1); st=$?
        if [ $st -ne 0 ]; then echo "  diagnostics acl $rel: query FAILED (psql exit $st): $(echo "$out" | head -c 300)"
        else echo "  diagnostics acl $rel: ${out:-<relation not found>}"; fi ;;
    esac
  done
}
rc=0
compare "live-verified (functions, policies, triggers, rls, grants)" "$T/live6" "$T/local6" || rc=1
compare "snapshot-derived (tables, columns, constraints, indexes, views, enums) — comparison to the live catalog UNVERIFIED" "$T/snapX" "$T/localX" || rc=1
# Always retained, pass or fail: the runtime text of the one view whose rendering differs between PG15 and PG16,
# with both hashes and the manifest's expected signature, so the version-aware equivalence is auditable per run.
echo "[evidence] view coursera_crawl_progress (manifest signature $(awk -F'\t' '$1=="view" && $2=="coursera_crawl_progress"{print $3}' "$SNAP/identities-snapshot-derived.tsv")):"
view_evidence coursera_crawl_progress || { echo "[evidence] FAILED: coursera_crawl_progress evidence could not be produced" >&2; rc=1; }
exit $rc
