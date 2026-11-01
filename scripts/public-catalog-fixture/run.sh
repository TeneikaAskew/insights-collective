#!/usr/bin/env bash
# ABOUTME: Anonymous public-catalog acceptance runner for an OWNED, disposable loopback Supabase stack that is already up and
# ABOUTME: bootstrapped (scripts/local-stack, owned by another lane) with the app served against it. Not run by anything yet.
#
# Order (each step fails closed): guards -> served-build check -> witness W0 -> seed -> witness W1 -> browser specs ->
# witness W2 (must equal W1: anonymous browsing wrote nothing) -> anon RLS probe (reads, then run-owned write attempts)
# -> witness W3 (must equal W1, else the probe proves an accepted write). No cleanup: the stack is destroyed with the job.
set -u -o pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
OUT="${PUBLIC_ACCEPT_OUT:?set PUBLIC_ACCEPT_OUT to a new, empty evidence directory}"
[ -e "$OUT" ] && { echo "PUBLIC_CATALOG_E_OUT_EXISTS: $OUT"; exit 2; }
mkdir -p "$OUT" && chmod 700 "$OUT"
step() { echo "== $1" | tee -a "$OUT/STEPS.txt"; }
psqlx() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$PUBLIC_ACCEPT_DB_URL" -X -q -At "$@"; }

[ "${PUBLIC_ACCEPT_TIER:-authentic}" = authentic ] || { echo "PUBLIC_CATALOG_E_TIER: run.sh runs the authentic tier only"; exit 2; }
export PUBLIC_ACCEPT_TIER=authentic
step guards;        node "$HERE/guards.mjs" > "$OUT/guards.txt" 2>&1 || { cat "$OUT/guards.txt"; exit 2; }
step served-build;  node "$HERE/served-build-check.mjs" > "$OUT/served-build.txt" 2>&1 || { cat "$OUT/served-build.txt"; exit 2; }
# The served directory must be the reviewed hermetic test-served derivation (scripts/served-app, owned by the local-stack lane;
# not on main yet). Without that contract the run cannot start: the product index.html loads cdn.gpteng.co for every visitor.
step hermetic;      { [ -f "$ROOT/scripts/served-app/hermetic-dist.mjs" ] && [ -n "${PUBLIC_ACCEPT_PRODUCT_DIST:-}" ] && [ -n "${PUBLIC_ACCEPT_SERVED_DIR:-}" ]; } \
                      || { echo "PUBLIC_CATALOG_E_NO_HERMETIC_CONTRACT: scripts/served-app/hermetic-dist.mjs and PUBLIC_ACCEPT_PRODUCT_DIST/SERVED_DIR are required"; exit 2; }
                    node "$ROOT/scripts/served-app/hermetic-dist.mjs" verify "$PUBLIC_ACCEPT_PRODUCT_DIST" "$PUBLIC_ACCEPT_SERVED_DIR" > "$OUT/hermetic-verify.txt" 2>&1 || { cat "$OUT/hermetic-verify.txt"; exit 2; }
step W0;            psqlx -f "$HERE/witness.sql" > "$OUT/W0.txt" || exit 2
step seed;          psqlx -f "$HERE/seed.sql" > "$OUT/seed.txt" 2>&1 || { cat "$OUT/seed.txt"; exit 2; }
step W1;            psqlx -f "$HERE/witness.sql" > "$OUT/W1.txt" || exit 2
node --input-type=module -e "import('$HERE/fixtures.mjs').then((m) => import('node:fs').then((fs) => fs.writeFileSync('$OUT/MANIFEST.json', JSON.stringify({ ids: m.ALL_IDS, created_by: 'seed.sql' }, null, 2))))" || exit 2
step browser;       (cd "$ROOT" && PUBLIC_ACCEPT_REPORT="$OUT/playwright.json" timeout 1800 npx playwright test -c playwright.public-catalog.config.ts --output="$OUT/pw" > "$OUT/playwright.log" 2>&1); echo $? > "$OUT/playwright.exit"
step W2;            psqlx -f "$HERE/witness.sql" > "$OUT/W2.txt" || exit 2
cmp -s "$OUT/W1.txt" "$OUT/W2.txt" && echo unchanged > "$OUT/W1-W2.txt" || diff "$OUT/W1.txt" "$OUT/W2.txt" > "$OUT/W1-W2.txt"
step anon-probe;    node "$HERE/anon-probe.mjs" "$OUT/anon-probe.json" > "$OUT/anon-probe.txt" 2>&1; echo $? > "$OUT/anon-probe.exit"
step W3;            psqlx -f "$HERE/witness.sql" > "$OUT/W3.txt" || exit 2
cmp -s "$OUT/W1.txt" "$OUT/W3.txt" && echo unchanged > "$OUT/W1-W3.txt" || diff "$OUT/W1.txt" "$OUT/W3.txt" > "$OUT/W1-W3.txt"
rc=0
[ "$(cat "$OUT/playwright.exit")" = 0 ] || rc=1
[ "$(cat "$OUT/W1-W2.txt")" = unchanged ] || { echo "DB changed during anonymous browsing"; rc=1; }
[ "$(cat "$OUT/anon-probe.exit")" = 0 ] || rc=1
[ "$(cat "$OUT/W1-W3.txt")" = unchanged ] || { echo "an anonymous write was accepted"; rc=1; }
echo "exit $rc" | tee -a "$OUT/STEPS.txt"; exit $rc
