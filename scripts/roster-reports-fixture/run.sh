#!/usr/bin/env bash
# ABOUTME: Ordered runner ADAPTER for the T-15 Students/Reports persona acceptance (UNRUN). Reuses the gradebook-owned
# ABOUTME: private psql, local binding and origin guard, and the shared D1 stack-ownership record, all unchanged.
#
# Usage: scripts/roster-reports-fixture/run.sh <evidence dir (must not exist)>
# Env (from the shared owner's job only): SUPABASE_DB_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, E2E_BASE_URL,
#   E2E_TEST_PASSWORD, STACK_OWNERSHIP_FILE, RR_D1_BOOTSTRAP_SHA256 (the job's reviewed constant). Loopback only.
# Order: deps, guards, private dirs, D1 verify, seed, association nonce, witness pre, Playwright, witness post, compare,
# inventory. Raw streams stay in a private 0700 dir removed on exit; the evidence dir gets fixed summary lines only.
# No DB cleanup: the stack is disposable and destroyed by the job. The run is read-only after the seed.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"; HERE="$ROOT/scripts/roster-reports-fixture"
refuse() { echo "rr-run refused: $1" >&2; exit "${2:-3}"; }
OUT="${1:-}"; [ -n "$OUT" ] || refuse RR_E_USAGE 2
[ ! -e "$OUT" ] || refuse RR_E_OUT_EXISTS 2

# 0. Shared runner files this adapter depends on (delivered by the shared owner; not in this branch's base yet).
for f in scripts/gradebook-fixture/journey/private-psql.mjs scripts/e2e/gb-job-psql.mjs scripts/e2e/stack-ownership.mjs \
         e2e/gradebook-roles/local-binding.mjs e2e/gradebook-roles/origin-guard.mjs scripts/e2e/assert-safe-target.mjs; do
  [ -f "$ROOT/$f" ] || refuse "RR_E_DEPS $f"
done
[[ "${RR_D1_BOOTSTRAP_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || refuse RR_E_D1_CONSTANT
# 1. Target guards (shared helpers, unchanged; the DSN is checked in-process, never on argv).
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || refuse RR_E_TARGET
(cd "$ROOT" && node e2e/gradebook-roles/local-binding.mjs >/dev/null 2>&1) || refuse RR_E_BINDING
# 2. One fresh private parent; the trap removes exactly it.
TMPROOT="$(cd "${RUNNER_TEMP:-${TMPDIR:-/tmp}}" && pwd -P)"
PARENT="$(mktemp -d "$TMPROOT/rr-run.XXXXXXXXXX")" || refuse RR_E_DIRS
cleanup() { case "$PARENT" in "$TMPROOT"/rr-run.??????????) [ -d "$PARENT" ] && [ ! -L "$PARENT" ] && rm -rf -- "$PARENT" ;; esac; }
trap cleanup EXIT
mkdir -m 700 "$PARENT/raw" "$PARENT/session" "$PARENT/psql" || refuse RR_E_DIRS
RAW="$PARENT/raw"
mkdir -m 700 "$OUT" || refuse RR_E_DIRS
psql_run() { node "$ROOT/scripts/gradebook-fixture/journey/private-psql.mjs" run "$PARENT/psql" "$1" "$2" > "$RAW/$3.out" 2> "$RAW/$3.err"; }
# 3. D1: this run owns this cluster (live system identifier, these origins, the reviewed bootstrap constant).
API=$(node -e 'console.log(new URL(process.argv[1]).origin)' "$VITE_SUPABASE_URL")
APP=$(node -e 'console.log(new URL(process.argv[1]).origin)' "$E2E_BASE_URL")
node "$ROOT/scripts/e2e/gb-job-psql.mjs" sysid "$PARENT/psql" 2> "$RAW/sysid.err" \
  | node "$ROOT/scripts/e2e/stack-ownership.mjs" verify "$API" "$APP" "$RR_D1_BOOTSTRAP_SHA256" > "$RAW/d1.out" 2> "$RAW/d1.err" || refuse RR_E_D1
# 4. Seed (refuses if any fixture id exists).
psql_run "$HERE/seed.sql" "$RAW/seed.raw" seed || refuse RR_E_SEED
grep -qx 'RR_SEED_OK courses=3 modules=4 items=8 users=5 enrollments=8 progressions=12' "$RAW/seed.raw" || refuse RR_E_SEED
echo 'RR_SEED_OK courses=3 modules=4 items=8 users=5 enrollments=8 progressions=12' > "$OUT/seed.txt"
# 5. Association nonce through the DSN, read back through the API by session-setup.ts.
NONCE="$(node -e 'console.log(require("crypto").randomBytes(16).toString("hex"))')"
cat > "$PARENT/psql/assoc.sql" <<SQL
\\set ON_ERROR_STOP 1
update public.courses set description = 'rr-association:$NONCE' where id = '7150a000-0000-4000-8000-000000000001' and description = 'rr-association:pending';
select case when count(*) = 1 then 'RR_ASSOC_OK' else 'RR_ASSOC_BAD' end from public.courses where id = '7150a000-0000-4000-8000-000000000001' and description = 'rr-association:$NONCE';
SQL
psql_run "$PARENT/psql/assoc.sql" "$RAW/assoc.raw" assoc || refuse RR_E_ASSOC
grep -qx RR_ASSOC_OK "$RAW/assoc.raw" || refuse RR_E_ASSOC
# 6. Witness before.
psql_run "$HERE/witness.sql" "$RAW/witness-pre.txt" witness-pre || refuse RR_E_WITNESS_PRE
# 7. Playwright. Raw reporter output stays private; one validated count line is staged.
set +e
(cd "$ROOT" && RR_SESSION_DIR="$PARENT/session" RR_ASSOCIATION_NONCE="$NONCE" npx --no-install playwright test \
  -c playwright.roster-reports.config.ts --reporter=json --output="$RAW/test-results") > "$RAW/playwright.json" 2> "$RAW/playwright.err"; PW=$?
set -e
node "$HERE/summary.mjs" playwright "$RAW/playwright.json" "$PW" > "$OUT/playwright-summary.txt" 2> "$RAW/summary.err" || refuse RR_E_SUMMARY
# 8. Witness after; the run is read-only, so the two must be identical.
psql_run "$HERE/witness.sql" "$RAW/witness-post.txt" witness-post || refuse RR_E_WITNESS_POST
rc=0
node "$HERE/summary.mjs" witness "$RAW/witness-pre.txt" "$RAW/witness-post.txt" > "$OUT/witness.txt" 2> "$RAW/witness-cmp.err" || rc=1
[ "$PW" -eq 0 ] || rc=1
# 9. Exact inventory.
[ "$(ls -A "$OUT" | LC_ALL=C sort | tr '\n' ' ')" = "playwright-summary.txt seed.txt witness.txt " ] || refuse RR_E_INVENTORY
cat "$OUT/seed.txt" "$OUT/playwright-summary.txt" "$OUT/witness.txt"
exit $rc
