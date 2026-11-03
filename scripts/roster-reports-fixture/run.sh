#!/usr/bin/env bash
# ABOUTME: Ordered runner ADAPTER for the T-15 Students/Reports persona acceptance (UNRUN). Reuses pinned shared helpers
# ABOUTME: unchanged (PINS.txt). Prewrite proofs before any fixture write; post witness and cleanup run even on failure.
#
# Usage: scripts/roster-reports-fixture/run.sh <evidence dir (must not exist)> [default|pending]
# Env (from the shared owner's job only): SUPABASE_DB_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, E2E_BASE_URL,
#   E2E_TEST_PASSWORD, STACK_OWNERSHIP_FILE, RR_D1_BOOTSTRAP_SHA256, HERMETIC_SERVED_DIR, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
#   GB_SHELL_PATH. Loopback only.
# Order (before ANY fixture write): helper pins, D1 constant equality, guards, served-app gate, pinned shell, private dirs,
#   D1 verify; then the 1-row carrier, its DSN and anon-API readback, and only then the seed. After the seed: witness
#   (exact projection), Playwright, summary, witness again, compare, private cleanup with verified absence, inventory.
# Exit: the first failing code wins (Playwright's own nonzero exit is preserved); every collect step still runs.
# Streams: raw stdout/stderr stay in one private 0700 parent; the evidence dir gets fixed-enum summary lines only, each
#   matching the job's staging grammar (summary.mjs LINE). The parent is "$RUNNER_TEMP"/rr-run.XXXXXXXXXX, the shape the
#   job's always() step also removes.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"; HERE="$ROOT/scripts/roster-reports-fixture"
refuse() { echo "rr-run refused: $1" >&2; exit "${2:-3}"; }
OUT="${1:-}"; VARIANT="${2:-default}"
[ -n "$OUT" ] || refuse RR_E_USAGE 2
case "$VARIANT" in default) ;; pending) [ "${RR_ERROR_INJECTION:-}" = 1 ] || refuse RR_E_VARIANT 2 ;; *) refuse RR_E_USAGE 2 ;; esac
[ "$VARIANT" = pending ] || [ -z "${RR_ERROR_INJECTION:-}" ] || refuse RR_E_VARIANT 2
[ ! -e "$OUT" ] && [ ! -L "$OUT" ] || refuse RR_E_OUT_EXISTS 2

# 0. Trusted constants and pins. The job's env is checked AGAINST the committed constant; it is never the provenance.
pin() { sed -n "s/^\([0-9a-f]\{64\}\)  $(printf '%s' "$1" | sed 's/[\/.]/\\&/g')\$/\1/p" "$HERE/PINS.txt"; }
for f in scripts/gradebook-fixture/journey/private-psql.mjs scripts/e2e/gb-job-psql.mjs scripts/e2e/stack-ownership.mjs \
         e2e/gradebook-roles/local-binding.mjs e2e/gradebook-roles/origin-guard.mjs scripts/e2e/assert-safe-target.mjs \
         scripts/local-db/assert-local-dsn.mjs scripts/served-app/served-app-check.mjs scripts/served-app/hermetic-dist.mjs \
         scripts/local-stack/bootstrap.sh; do
  want="$(pin "$f")"; [ -n "$want" ] || refuse "RR_E_PIN_MISSING $f"
  [ -f "$ROOT/$f" ] && [ ! -L "$ROOT/$f" ] || refuse "RR_E_DEPS $f"
  [ "$(sha256sum "$ROOT/$f" | cut -d' ' -f1)" = "$want" ] || refuse "RR_E_PIN $f"
done
D1C="$(sed -n 's/^D1_BOOTSTRAP_SHA256=\([0-9a-f]\{64\}\)$/\1/p' "$HERE/PINS.txt")"
[ -n "$D1C" ] && [ "${RR_D1_BOOTSTRAP_SHA256:-}" = "$D1C" ] || refuse RR_E_D1_CONSTANT
[ "$(pin scripts/local-stack/bootstrap.sh)" = "$D1C" ] || refuse RR_E_D1_CONSTANT
# 1. Target guards, then the final served/shell integration (the job's gates re-checked here, immediately before use).
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || refuse RR_E_TARGET
(cd "$ROOT" && node e2e/gradebook-roles/local-binding.mjs >/dev/null 2>&1) || refuse RR_E_BINDING
[ -n "${GB_SHELL_PATH:-}" ] && [ "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" = "$GB_SHELL_PATH" ] || refuse RR_E_SHELL
[ "$(node "$ROOT/scripts/served-app/served-app-check.mjs" "$E2E_BASE_URL" 2>/dev/null)" = "served-app SA_OK" ] || refuse RR_E_SERVED_APP
# 2. One fresh private parent, validated (real dir, this user, 0700); the trap removes exactly it.
TMPROOT="$(cd "${RUNNER_TEMP:-${TMPDIR:-/tmp}}" && pwd -P)"
PARENT="$(mktemp -d "$TMPROOT/rr-run.XXXXXXXXXX")" || refuse RR_E_DIRS
cleanup() { case "$PARENT" in "$TMPROOT"/rr-run.??????????) [ -d "$PARENT" ] && [ ! -L "$PARENT" ] && rm -rf -- "$PARENT" ;; esac; }
trap cleanup EXIT
private_ok() { [ -d "$1" ] && [ ! -L "$1" ] && [ "$(stat -c '%u %a' -- "$1")" = "$(id -u) 700" ]; }
chmod 700 "$PARENT"; private_ok "$PARENT" || refuse RR_E_DIRS
mkdir -m 700 "$PARENT/raw" "$PARENT/session" "$PARENT/psql" || refuse RR_E_DIRS
for d in raw session psql; do private_ok "$PARENT/$d" || refuse RR_E_DIRS; done
RAW="$PARENT/raw"; POLICY_LOG="$PARENT/session/policy.jsonl"
: > "$POLICY_LOG"; chmod 600 "$POLICY_LOG"
mkdir -m 700 "$OUT" || refuse RR_E_DIRS
psql_run() { node "$ROOT/scripts/gradebook-fixture/journey/private-psql.mjs" run "$PARENT/psql" "$1" "$2" > "$RAW/$3.out" 2> "$RAW/$3.err"; }
# 3. D1: this run owns this cluster (live system identifier, these origins, the committed bootstrap constant).
API=$(node -e 'console.log(new URL(process.argv[1]).origin)' "$VITE_SUPABASE_URL")
APP=$(node -e 'console.log(new URL(process.argv[1]).origin)' "$E2E_BASE_URL")
node "$ROOT/scripts/e2e/gb-job-psql.mjs" sysid "$PARENT/psql" 2> "$RAW/sysid.err" \
  | node "$ROOT/scripts/e2e/stack-ownership.mjs" verify "$API" "$APP" "$D1C" > "$RAW/d1.out" 2> "$RAW/d1.err" || refuse RR_E_D1
# 4. Minimal association BEFORE the seed: one carrier row through the DSN, read back through the anon API.
NONCE="$(node -e 'console.log(require("crypto").randomBytes(16).toString("hex"))')"
[[ "$NONCE" =~ ^[0-9a-f]{32}$ ]] || refuse RR_E_NONCE
sed "s/__NONCE__/$NONCE/" "$HERE/carrier.sql.in" > "$PARENT/psql/carrier.sql"
psql_run "$PARENT/psql/carrier.sql" "$RAW/carrier.raw" carrier || refuse RR_E_CARRIER
grep -qx RR_CARRIER_OK "$RAW/carrier.raw" || refuse RR_E_CARRIER
RR_NONCE="$NONCE" RR_API="$API" node -e '
  const k = process.env.VITE_SUPABASE_ANON_KEY;
  fetch(`${process.env.RR_API}/rest/v1/courses?id=eq.7150a000-0000-4000-8000-000000000001&select=description`, { redirect: "error", headers: { apikey: k, Authorization: `Bearer ${k}` } })
    .then(async (r) => { const j = r.status === 200 ? await r.json() : null; process.exit(Array.isArray(j) && j.length === 1 && j[0].description === `rr-association:${process.env.RR_NONCE}` ? 0 : 1); })
    .catch(() => process.exit(1));' > "$RAW/assoc-api.out" 2> "$RAW/assoc-api.err" || refuse RR_E_ASSOC_API
# 5. Seed (refuses unless exactly the carrier exists).
psql_run "$HERE/seed.sql" "$RAW/seed.raw" seed || refuse RR_E_SEED
grep -qx RR_SEED_OK "$RAW/seed.raw" || refuse RR_E_SEED
# 6. Witness right after the seed. From here on every collect step runs; RC keeps the first failure.
RC=0; keep() { [ "$RC" -ne 0 ] || RC="$1"; }
if psql_run "$HERE/witness.sql" "$RAW/witness-pre.txt" witness-pre; then
  if [ "$(grep '^SEED ' "$RAW/witness-pre.txt")" = "$(grep '^SEED ' "$HERE/expected-seed.txt")" ]; then
    echo "RR_SEED_OK projection=MATCHES lines=$(grep -c '^SEED ' "$HERE/expected-seed.txt")" > "$OUT/seed.txt"
  else echo "RR_SEED_BAD projection=DIFFERS" > "$OUT/seed.txt"; keep 4; fi
else echo "RR_SEED_BAD witness_pre=FAILED" > "$OUT/seed.txt"; : > "$RAW/witness-pre.txt"; keep 4; fi
# 7. Playwright (skipped only if the seed projection is already wrong). Raw reporter output stays private.
PW=99
if [ "$RC" -eq 0 ]; then
  set +e
  (cd "$ROOT" && RR_SESSION_DIR="$PARENT/session" RR_POLICY_LOG="$POLICY_LOG" RR_ASSOCIATION_NONCE="$NONCE" npx --no-install playwright test \
    -c playwright.roster-reports.config.ts --reporter=json --output="$RAW/test-results") > "$RAW/playwright.json" 2> "$RAW/playwright.err"; PW=$?
  set -e
fi
[ "$PW" -eq 0 ] || keep "$PW"
if [ -s "$RAW/playwright.json" ]; then
  node "$HERE/summary.mjs" playwright "$RAW/playwright.json" "$PW" "$VARIANT" > "$OUT/playwright-summary.txt" 2> "$RAW/summary.err" || keep 5
else echo "PLAYWRIGHT exit=$PW report=ABSENT verdict=FAIL" > "$OUT/playwright-summary.txt"; keep 5; fi
# 8. Witness after (always attempted), then the exact comparison including telemetry reconciliation.
if psql_run "$HERE/witness.sql" "$RAW/witness-post.txt" witness-post; then
  node "$HERE/summary.mjs" witness "$HERE/expected-seed.txt" "$RAW/witness-pre.txt" "$RAW/witness-post.txt" "$POLICY_LOG" > "$OUT/witness.txt" 2> "$RAW/witness-cmp.err" || keep 6
else echo "WITNESS POST FAILED verdict=FAIL" > "$OUT/witness.txt"; keep 6; fi
# 9. Private cleanup now (the trap stays as a backstop), with verified absence as its own receipt.
cleanup || true
if [ -e "$PARENT" ] || [ -L "$PARENT" ]; then echo "PRIVATE STILL_PRESENT verdict=FAIL" > "$OUT/rr-private.txt"; keep 7
else echo "PRIVATE REMOVED scope=raw,session,policy_log,psql verdict=PASS" > "$OUT/rr-private.txt"; fi
# 10. Exact inventory.
[ "$(ls -A "$OUT" | LC_ALL=C sort | tr '\n' ' ')" = "playwright-summary.txt rr-private.txt seed.txt witness.txt " ] || keep 8
cat "$OUT/seed.txt" "$OUT/playwright-summary.txt" "$OUT/witness.txt" "$OUT/rr-private.txt"
exit "$RC"
