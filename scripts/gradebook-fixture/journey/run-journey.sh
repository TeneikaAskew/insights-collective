#!/usr/bin/env bash
# ABOUTME: Ordered runner ADAPTER for the no-quiz journey lane (UNRUN proposal, gradebook-owned). Fixed order: helper pins,
# ABOUTME: target guards, D1 stack ownership, composition, private dirs, pairing producer, seed, witness, journey, compare.
#
# Usage: scripts/gradebook-fixture/journey/run-journey.sh <evidence dir (must not exist)>
# Env (from the shared owner's job, which alone wires this into a workflow): SUPABASE_DB_URL, VITE_SUPABASE_URL,
#   VITE_SUPABASE_ANON_KEY, E2E_BASE_URL (served app), E2E_INSTRUCTOR_PASSWORD, E2E_MEMBER_PASSWORD. Loopback only.
# BLOCKED: step 2 (D1, the shared owner's stack-ownership record) is not defined yet and always refuses, before any DB
# contact. Output is fixed codes and PASS lines only; the pairing nonce never reaches this shell.
# Cleanup: the trap removes exactly this run's private parent dir (proof, session, diag). No DB cleanup: the stack is
# disposable and destroyed with the job (shared owner).
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/../../.." && pwd -P)"; HERE="$ROOT/scripts/gradebook-fixture/journey"; GB="$ROOT/scripts/gradebook-fixture"
refuse() { echo "run-journey refused: $1" >&2; exit "${2:-3}"; }
OUT="${1:-}"; [ -n "$OUT" ] || refuse RUN_E_USAGE 2
[ ! -e "$OUT" ] || refuse RUN_E_OUT_EXISTS 2

# 0. Shared helpers must be the agreed, unchanged blobs.
node "$HERE/pairing-producer.mjs" pins "$ROOT" >/dev/null || refuse RUN_E_PIN
# 1. Target guards (shared helpers reused unchanged, then the owned strict binding).
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || refuse RUN_E_TARGET
(cd "$ROOT" && node e2e/gradebook-roles/local-binding.mjs >/dev/null 2>&1) || refuse RUN_E_BINDING
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "${SUPABASE_DB_URL:-}" >/dev/null 2>&1 || refuse RUN_E_DSN
# 2. D1 stack ownership (shared owner's record). Refuses until its schema is delivered and reviewed.
node "$HERE/pairing-producer.mjs" ownership >/dev/null || refuse RUN_E_D1_UNDEFINED 5
# 3. Composition, detected from the database itself: composed-r5 only.
PSQL=(env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1)
GB_COMPOSITION=$("${PSQL[@]}" -f "$GB/composition.sql" | sed -n 's/^COMPOSITION //p'); export GB_COMPOSITION
[ "$GB_COMPOSITION" = composed-r5 ] || refuse RUN_E_COMPOSITION
# 4. Private dirs: one fresh 0700 parent, three distinct 0700 children; the trap removes exactly that parent.
TMPROOT="$(cd "${RUNNER_TEMP:-${TMPDIR:-/tmp}}" && pwd -P)"
PARENT="$(mktemp -d "$TMPROOT/gb-journey-run.XXXXXXXXXX")" || refuse RUN_E_DIRS
cleanup() { case "$PARENT" in "$TMPROOT"/gb-journey-run.??????????) [ -d "$PARENT" ] && [ ! -L "$PARENT" ] && rm -rf -- "$PARENT" ;; esac; }
trap cleanup EXIT
chmod 700 "$PARENT"; mkdir -m 700 "$PARENT/proof" "$PARENT/session" "$PARENT/diag" || refuse RUN_E_DIRS
export GB_SESSION_DIR="$PARENT/session" GB_DIAG_DIR="$PARENT/diag" GB_JOURNEY_PAIRING_PROOF="$PARENT/proof/pairing-proof.json"
mkdir -m 700 "$OUT"
echo "COMPOSITION $GB_COMPOSITION" > "$OUT/composition.txt"
# 5-8. Pairing producer: precheck, carrier insert, DSN readback, anon API readback, proof v2 (0600, own dir).
node "$HERE/pairing-producer.mjs" pair "$PARENT/proof" > "$OUT/pairing.txt" || refuse RUN_E_PAIRING
# 9. The rest of the seed, bound to this proof's nonce (refuses unless the carrier holds it).
node "$HERE/pairing-producer.mjs" seed "$GB_JOURNEY_PAIRING_PROOF" > "$OUT/seed.txt" || refuse RUN_E_SEED
# 10. Witness before the journey.
"${PSQL[@]}" -f "$HERE/witness-journey.sql" -At > "$OUT/witness-pre.txt"
# 11. The journey (its setup re-checks proof v2 and re-reads the carrier live before the first sign-in POST).
set +e
(cd "$ROOT" && GB_LANE=journey npx --no-install playwright test -c playwright.gradebook-roles.config.ts) > "$OUT/playwright.txt" 2>&1; PW=$?
set -e
# 12. Witness after, then the exact comparison.
"${PSQL[@]}" -f "$HERE/witness-journey.sql" -At > "$OUT/witness-post.txt"
rc=0
node "$HERE/tests/compare-witness.mjs" "$OUT/witness-pre.txt" "$OUT/witness-post.txt" > "$OUT/compare.txt" || rc=1
[ "$PW" -eq 0 ] || rc=1
# 13. Exact evidence inventory.
[ "$(ls -A "$OUT" | LC_ALL=C sort | tr '\n' ' ')" = "compare.txt composition.txt pairing.txt playwright.txt seed.txt witness-post.txt witness-pre.txt " ] || refuse RUN_E_INVENTORY
cat "$OUT/compare.txt"
[ "$PW" -eq 0 ] && echo "PASS playwright journey lane" || echo "FAIL playwright exit $PW"
exit $rc
