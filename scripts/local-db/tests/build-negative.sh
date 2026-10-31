#!/usr/bin/env bash
# ABOUTME: Proves the snapshot build fails closed: (a) same counts but one wrong function definition,
# ABOUTME: (b) an injected DDL failure, (c) a tampered manifest count — and (d) that the broken-view
# ABOUTME: omission is reported explicitly on the correct snapshot. Needs a running local cluster.
set -u
PGBASE="${1:?loopback libpq url WITHOUT database, e.g. postgresql://postgres@127.0.0.1:54329}"; SNAP="${2:?snapshot dir}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; rc=0
# This harness creates and drops databases, so it is itself a database-touching entrypoint: validate
# the effective libpq endpoint BEFORE the first psql process, and run every psql with the libpq
# environment overrides removed. The same strict parser the tools use; no second validator.
case "$PGBASE" in *\?*|*\#*) echo "refusing: PGBASE must be a bare scheme://user@host:port with no query or fragment" >&2; exit 2;; esac
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGBASE/postgres" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
mk() { local db="$1"; psql "$PGBASE/postgres" -qc "drop database if exists $db" >/dev/null 2>&1; psql "$PGBASE/postgres" -qc "create database $db" >/dev/null; }
expect() { # name expected-exit snapshot-dir db must-match-regex
  local name="$1" want="$2" snap="$3" db="$4" re="$5"; mk "$db"
  out=$("$ROOT/scripts/local-db/build-from-snapshot.sh" "$PGBASE/$db" "$snap" 2>&1); st=$?
  if [ "$st" -ne "$want" ]; then echo "FAIL $name (exit $st, expected $want)"; echo "$out" | tail -4 | sed 's/^/     /'; rc=1
  elif ! echo "$out" | grep -qE "$re"; then echo "FAIL $name (exit ok but output lacks /$re/)"; echo "$out" | tail -4 | sed 's/^/     /'; rc=1
  else echo "PASS $name (exit $st; matched /$re/)"; fi
}
T=$(mktemp -d)
# (d) correct snapshot: passes, and names the broken view it omitted
expect "correct snapshot builds and reports the live-broken view omission" 0 "$SNAP" ic_neg_ok "broken in the live catalog excluded.*quiz_analytics|omitted because they belong to live-broken"
# (a) same counts, one wrong definition: change a literal inside start_quiz_attempt's body
cp -r "$SNAP" "$T/wrong-identity"; sed -i "s/You must be signed in to start a quiz\./You must be signed in to start a quiz!/" "$T/wrong-identity/03_functions.sql"
grep -q "start a quiz!" "$T/wrong-identity/03_functions.sql" || { echo "FAIL setup: could not alter function body"; exit 1; }
expect "same-count wrong-identity snapshot is rejected" 1 "$T/wrong-identity" ic_neg_ident "IDENTITY MISMATCH.*|start_quiz_attempt"
# (b) injected DDL failure
cp -r "$SNAP" "$T/injected"; printf '\ncreate table public.zz_injected (id int references public.does_not_exist(id));\n' >> "$T/injected/02_constraints_indexes_views.sql"
expect "injected DDL failure is rejected" 1 "$T/injected" ic_neg_ddl "FATAL|BUILD FAILED"
# (c) tampered manifest count
cp -r "$SNAP" "$T/tampered"; sed -i 's/^POLICIES=.*/POLICIES=340/' "$T/tampered/manifest.env"
expect "tampered manifest count is rejected" 1 "$T/tampered" ic_neg_manifest "MANIFEST MISMATCH: POLICIES"
# (e) missing identities file
cp -r "$SNAP" "$T/noident"; rm -f "$T/noident/identities.tsv"
expect "snapshot without identities.tsv is rejected" 1 "$T/noident" ic_neg_noident "no identities.tsv"
for db in ic_neg_ok ic_neg_ident ic_neg_ddl ic_neg_manifest ic_neg_noident; do psql "$PGBASE/postgres" -qc "drop database if exists $db" >/dev/null 2>&1; done
rm -rf "$T"; echo "build-negative: exit $rc"; exit $rc
