#!/usr/bin/env bash
# ABOUTME: Builds a LOCAL database from a schema snapshot directory (DDL files produced from read-only
# ABOUTME: catalog queries) plus the Supabase shim. FAILS on any DDL error or on an object-count
# ABOUTME: mismatch against the snapshot manifest, so an incomplete replay can never pass as complete.
# Usage: scripts/local-db/build-from-snapshot.sh <loopback libpq url of an EMPTY database> <snapshot dir>
# Snapshot dir layout: 01_types_tables.sql 02_constraints_indexes_views.sql 03_functions.sql
#                      04_rls_policies.sql 05_triggers_grants.sql [06_matviews.sql] manifest.env
# manifest.env holds the live counts the replay must reproduce, e.g.
#   TABLES=120 VIEWS=7 MATVIEWS=0 FUNCTION_NAMES=118 POLICIES=341 TRIGGERS=51 RLS_TABLES=120 ENUMS=6
set -u
PGURL="${1:?url}"; SNAP="${2:?snapshot dir}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Strict DSN check BEFORE any psql call: single loopback endpoint, no multihost/hostaddr/service/env overrides.
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGURL" || exit 2
# psql always runs with libpq environment overrides removed, so the DSN we checked is the one used.
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
if ! probe=$(psql "$PGURL" -Atc "select count(*) from pg_roles where rolname in ('supabase_auth_admin','supabase_storage_admin','authenticator')" 2>&1); then
  echo "cannot connect to the local database: ${probe}" >&2; exit 2
fi
if [ "$probe" != "0" ]; then echo "refusing: this looks like a real Supabase database, not the local shim" >&2; exit 2; fi
if [ "$(psql "$PGURL" -Atc "select count(*) from pg_tables where schemaname='public'")" != "0" ]; then
  echo "refusing: target database is not empty (public schema has tables)" >&2; exit 2
fi
ERRLOG=$(mktemp); FAIL=0
run_strict() { # file -> apply with ON_ERROR_STOP; any error is fatal
  if ! psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$1" >>"$ERRLOG" 2>&1; then echo "FATAL in $(basename "$1"):"; grep -E "ERROR" "$ERRLOG" | tail -3; FAIL=1; fi
}
# Idempotency noise from re-applying DDL that has no IF NOT EXISTS form (ADD CONSTRAINT, CREATE
# TRIGGER, CREATE INDEX without IF NOT EXISTS) is not a replay failure; every other error is.
BENIGN='already exists|multiple primary keys for table'
# Objects the LIVE catalog holds but cannot evaluate (manifest VIEWS_BROKEN_LIVE, e.g. a view with
# "infinite recursion detected in rules") can never replay; errors naming exactly those objects are
# excluded from the failure count and reported separately. Anything else still fails the build.
if [ -f "$SNAP/manifest.env" ]; then . "$SNAP/manifest.env"; fi
if [ -n "${VIEWS_BROKEN_LIVE:-}" ]; then
  BROKEN_RE=$(echo "$VIEWS_BROKEN_LIVE" | tr ',' '|')
  BENIGN="$BENIGN|relation \"(public\\.)?($BROKEN_RE)\" does not exist"
fi
run_passes() { # file -> apply repeatedly (dependency order unknown) until no real error remains
  local f="$1" pass errs
  for pass in 1 2 3 4 5 6; do
    errs=$(psql "$PGURL" -q -f "$f" 2>&1 | grep "ERROR" | grep -vE "$BENIGN" | wc -l)
    [ "$errs" = "0" ] && return 0
  done
  echo "FATAL: $(basename "$f") still has $errs real error(s) after 6 passes:"; psql "$PGURL" -q -f "$f" 2>&1 | grep ERROR | grep -vE "$BENIGN" | sort | uniq -c | head -10; FAIL=1
}
run_strict "$ROOT/scripts/local-db/supabase-shim.sql"
run_strict "$SNAP/01_types_tables.sql"
[ -f "$SNAP/06_matviews.sql" ] && run_passes "$SNAP/06_matviews.sql"
run_passes "$SNAP/03_functions.sql"
run_passes "$SNAP/02_constraints_indexes_views.sql"
[ -f "$SNAP/06_matviews.sql" ] && run_passes "$SNAP/06_matviews.sql"
run_passes "$SNAP/02_constraints_indexes_views.sql"
run_strict "$SNAP/04_rls_policies.sql"
run_passes "$SNAP/05_triggers_grants.sql"
run_strict "$ROOT/scripts/local-db/post-functions.sql"
[ $FAIL -ne 0 ] && { echo "BUILD FAILED: incomplete schema replay"; exit 1; }

# Object-count manifest: the replay must reproduce the live catalog exactly.
count() { psql "$PGURL" -Atc "$1"; }
GOT_TABLES=$(count "select count(*) from pg_tables where schemaname='public'")
GOT_VIEWS=$(count "select count(*) from pg_views where schemaname='public'")
GOT_MATVIEWS=$(count "select count(*) from pg_matviews where schemaname='public'")
# Exclude functions owned by extensions: the shim installs pgcrypto/uuid-ossp/pg_trgm/citext in
# public, whereas the live project keeps them in the extensions schema. Only repo-defined
# functions are compared.
GOT_FUNCTION_NAMES=$(count "select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e')")
GOT_POLICIES=$(count "select count(*) from pg_policies where schemaname='public'")
GOT_TRIGGERS=$(count "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where nspname='public' and not tgisinternal")
GOT_RLS_TABLES=$(count "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where nspname='public' and relkind='r' and relrowsecurity")
GOT_ENUMS=$(count "select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where nspname='public' and typtype='e'")
echo "built: tables=$GOT_TABLES views=$GOT_VIEWS matviews=$GOT_MATVIEWS function_names=$GOT_FUNCTION_NAMES policies=$GOT_POLICIES triggers=$GOT_TRIGGERS rls_tables=$GOT_RLS_TABLES enums=$GOT_ENUMS"
if [ -f "$SNAP/manifest.env" ]; then
  # shellcheck disable=SC1090
  . "$SNAP/manifest.env"
  # VIEWS_BROKEN_LIVE lists views the live catalog holds but cannot evaluate (e.g. a self-referencing
  # definition). They are counted in VIEWS but can never be replayed, so subtract them explicitly
  # rather than letting the mismatch pass silently.
  if [ -n "${VIEWS_BROKEN_LIVE:-}" ]; then
    n_broken=$(echo "$VIEWS_BROKEN_LIVE" | tr ',' '\n' | grep -c .)
    VIEWS=$((VIEWS - n_broken)); echo "note: ${n_broken} view(s) broken in the live catalog excluded from the view count: $VIEWS_BROKEN_LIVE"
  fi
  for k in TABLES VIEWS MATVIEWS FUNCTION_NAMES POLICIES TRIGGERS RLS_TABLES ENUMS; do
    exp="${!k:-}"; got_var="GOT_$k"; got="${!got_var}"
    if [ -n "$exp" ] && [ "$exp" != "$got" ]; then echo "MANIFEST MISMATCH: $k expected $exp, got $got"; FAIL=1; fi
  done
  [ $FAIL -ne 0 ] && { echo "BUILD FAILED: replay does not match the live catalog manifest"; exit 1; }
  echo "manifest OK: replay matches the live catalog counts"
else
  echo "BUILD FAILED: no manifest.env in $SNAP — counts cannot be verified against the live catalog" >&2
  exit 1
fi

# Identity verification: every function, policy, trigger, RLS flag and grant must match the live
# definition hash object-by-object (identities.tsv, produced from the live catalog with the same query
# as scripts/local-db/identities.sql). Counts alone cannot catch a same-count wrong-definition replay.
if [ ! -f "$SNAP/identities.tsv" ]; then echo "BUILD FAILED: no identities.tsv in $SNAP — object definitions cannot be verified" >&2; exit 1; fi
LOCAL_ID=$(mktemp); LIVE_ID=$(mktemp)
psql "$PGURL" -Atq -f "$ROOT/scripts/local-db/identities.sql" | sort > "$LOCAL_ID"
sort "$SNAP/identities.tsv" > "$LIVE_ID"
BROKEN_FILTER='^$'
if [ -n "${VIEWS_BROKEN_LIVE:-}" ]; then BROKEN_FILTER="^(table_grant)	($(echo "$VIEWS_BROKEN_LIVE" | tr ',' '|'))→"; fi
missing=$(comm -23 "$LIVE_ID" "$LOCAL_ID" | grep -vE "$BROKEN_FILTER" || true)
extra=$(comm -13 "$LIVE_ID" "$LOCAL_ID" || true)
omitted=$(comm -23 "$LIVE_ID" "$LOCAL_ID" | grep -E "$BROKEN_FILTER" | cut -f1,2 || true)
if [ -n "$omitted" ]; then echo "note: identities omitted because they belong to live-broken objects:"; echo "$omitted" | sed 's/^/   /'; fi
if [ -n "$missing" ] || [ -n "$extra" ]; then
  echo "IDENTITY MISMATCH against the live catalog:"
  [ -n "$missing" ] && { echo "  live but not reproduced (or definition differs):"; echo "$missing" | cut -f1,2 | sed 's/^/   /' | head -20; }
  [ -n "$extra" ] && { echo "  local but not live (or definition differs):"; echo "$extra" | cut -f1,2 | sed 's/^/   /' | head -20; }
  echo "BUILD FAILED: replayed object definitions do not match the live catalog"; exit 1
fi
echo "identities OK: $(wc -l < "$LOCAL_ID") object identities match the live catalog ($(echo "$omitted" | grep -c . ) omitted for live-broken objects)"
