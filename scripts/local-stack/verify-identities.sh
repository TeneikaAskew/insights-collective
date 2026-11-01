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
# diag: bounded raw evidence for mismatched views and table grants, so a failed run explains itself without a rerun:
# server version, reloptions, the RAW runtime definition (first 2000 chars) and both signature forms for up to 5
# views; the raw ACL (relacl, with grantors) for up to 10 tables. Values are catalog text only; no row data.
diag() {
  local kind ident n_v=0 n_g=0 rel
  while IFS=$'\t' read -r kind ident; do
    case "$kind" in
      view) n_v=$((n_v+1)); [ $n_v -gt 5 ] && continue
        echo "  diagnostics view $ident (server $(psql "$PGURL" -Atc 'show server_version_num')):"
        psql "$PGURL" -At -v v="$ident" -c "select '    reloptions: ' || coalesce(array_to_string(c.reloptions, ','), '<none>') || E'\n    raw definition (pg_get_viewdef, first 2000 chars):\n' || left(pg_get_viewdef(c.oid, true), 2000) || E'\n    md5(raw form): ' || md5(coalesce(array_to_string(c.reloptions, ','), '') || '|' || pg_get_viewdef(c.oid, true)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=:'v'" </dev/null 2>&1 | head -60 ;;
      table_grant) n_g=$((n_g+1)); [ $n_g -gt 10 ] && continue; rel="${ident%%→*}"
        psql "$PGURL" -At -v r="$rel" -c "select '  diagnostics acl ' || c.relname || ': owner=' || c.relowner::regrole::text || ' relacl=' || coalesce(c.relacl::text, '<default>') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=:'r'" </dev/null 2>&1 | head -3 ;;
    esac
  done
}
rc=0
compare "live-verified (functions, policies, triggers, rls, grants)" "$T/live6" "$T/local6" || rc=1
compare "snapshot-derived (tables, columns, constraints, indexes, views, enums) — comparison to the live catalog UNVERIFIED" "$T/snapX" "$T/localX" || rc=1
exit $rc
