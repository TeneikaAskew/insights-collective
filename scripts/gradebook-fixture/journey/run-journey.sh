#!/usr/bin/env bash
# ABOUTME: Ordered runner ADAPTER for the no-quiz journey lane (UNRUN proposal, gradebook-owned). Fixed order: shared pins,
# ABOUTME: guards, private dirs, D1 ownership, served-app gate, composition, pairing, seed, witness, journey, compare.
#
# Usage: scripts/gradebook-fixture/journey/run-journey.sh <evidence dir (must not exist)>
# Env (from the shared owner's job, which alone wires this into a workflow): SUPABASE_DB_URL, VITE_SUPABASE_URL,
#   VITE_SUPABASE_ANON_KEY, E2E_BASE_URL (served app), E2E_INSTRUCTOR_PASSWORD, E2E_MEMBER_PASSWORD, STACK_OWNERSHIP_FILE,
#   GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT. Loopback only.
# BLOCKED: step 0 refuses while the shared D1 module is not in this branch's base, and steps 3-4 refuse until the shared
# owner delivers a trusted bootstrap identity and a hermetic served-app verifier (both pinned in pairing-producer.mjs).
# Streams: no DSN, password or nonce is ever on a command line (psql runs through private-psql.mjs with -w and a private
# passfile; the DSN is read from the environment and checked in-process). Every child's raw stdout/stderr goes to the
# private raw dir only; the evidence dir receives ONLY validated fixed summaries. The trap removes the private parent
# (proof, session, diag, raw) on every exit. No DB cleanup: the stack is disposable and destroyed with the job.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/../../.." && pwd -P)"; HERE="$ROOT/scripts/gradebook-fixture/journey"; GB="$ROOT/scripts/gradebook-fixture"
refuse() { echo "run-journey refused: $1" >&2; exit "${2:-3}"; }
OUT="${1:-}"; [ -n "$OUT" ] || refuse RUN_E_USAGE 2
[ ! -e "$OUT" ] || refuse RUN_E_OUT_EXISTS 2

# 0. Shared files must be the agreed, unchanged blobs.
node "$HERE/pairing-producer.mjs" pins "$ROOT" >/dev/null 2>&1 || refuse RUN_E_PIN
# 1. Target guards (shared helper reused unchanged; the DSN is checked in-process, never passed on argv).
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || refuse RUN_E_TARGET
(cd "$ROOT" && node e2e/gradebook-roles/local-binding.mjs >/dev/null 2>&1) || refuse RUN_E_BINDING
node "$HERE/pairing-producer.mjs" dsn >/dev/null 2>&1 || refuse RUN_E_DSN
# 2. Private dirs: one fresh 0700 parent, five distinct 0700 children; the trap removes exactly that parent.
TMPROOT="$(cd "${RUNNER_TEMP:-${TMPDIR:-/tmp}}" && pwd -P)"
PARENT="$(mktemp -d "$TMPROOT/gb-journey-run.XXXXXXXXXX")" || refuse RUN_E_DIRS
cleanup() { case "$PARENT" in "$TMPROOT"/gb-journey-run.??????????) [ -d "$PARENT" ] && [ ! -L "$PARENT" ] && rm -rf -- "$PARENT" ;; esac; }
trap cleanup EXIT
chmod 700 "$PARENT"; mkdir -m 700 "$PARENT/proof" "$PARENT/session" "$PARENT/diag" "$PARENT/raw" "$PARENT/shots" || refuse RUN_E_DIRS
RAW="$PARENT/raw"
export GB_SESSION_DIR="$PARENT/session" GB_DIAG_DIR="$PARENT/diag" GB_SHOT_DIR="$PARENT/shots" GB_JOURNEY_PAIRING_PROOF="$PARENT/proof/pairing-proof.json"
mkdir -m 700 "$OUT" || refuse RUN_E_DIRS
# step <fixed code> <raw name> <exact expected stdout line> -- command...: raw streams private, stdout must be that line.
step() {
  local code="$1" name="$2" want="$3"; shift 4
  if ! "$@" > "$RAW/$name.out" 2> "$RAW/$name.err"; then
    # Surface the child's own fixed code only (upper-case token, no path or value); everything else stays private.
    local sub; sub="$(sed -n 's/^run-journey refused: \([A-Z0-9_]*\)$/\1/p' "$RAW/$name.out" | head -n 1)"
    refuse "$code${sub:+ $sub}"
  fi
  [ "$(cat "$RAW/$name.out")" = "$want" ] || refuse "$code"
}
# 3. D1 stack ownership (shared record, pinned bootstrap identity, live cluster identity, these origins).
step RUN_E_D1 ownership "PASS stack ownership record verified for this run, this cluster and the pinned bootstrap (disposable is declared, not proven)" -- node "$HERE/pairing-producer.mjs" ownership "$RAW"
# 4. Served app verified by the pinned shared verifier, before the first write.
step RUN_E_APP appverify "PASS served app verified by the pinned shared verifier" -- node "$HERE/pairing-producer.mjs" appverify
# 5. Composition, detected from the database itself: exactly one line, composed-r5.
node "$HERE/private-psql.mjs" run "$RAW" "$GB/composition.sql" "$RAW/composition.raw" > "$RAW/composition.out" 2> "$RAW/composition.err" || refuse RUN_E_COMPOSITION
[ "$(grep -c '^COMPOSITION ' "$RAW/composition.raw")" = 1 ] && [ "$(grep '^COMPOSITION ' "$RAW/composition.raw")" = "COMPOSITION composed-r5" ] || refuse RUN_E_COMPOSITION
export GB_COMPOSITION=composed-r5
echo "COMPOSITION composed-r5" > "$OUT/composition.txt"
# 6. Pairing producer: precheck, carrier insert, DSN readback, anon API readback, proof v2 (0600, own dir).
step RUN_E_PAIRING pairing "PASS pairing: carrier written through the DSN, read back through the DSN and the anon API" -- node "$HERE/pairing-producer.mjs" pair "$PARENT/proof" "$RAW"
cp "$RAW/pairing.out" "$OUT/pairing.txt"
# 7. The rest of the seed, bound to this proof's nonce (refuses unless the carrier holds it).
step RUN_E_SEED seed "PASS journey seed: 1 draft course (1 module, page + 10-point upload assignment) and 1 published control course (1 module, 1 page); nothing else" -- node "$HERE/pairing-producer.mjs" seed "$GB_JOURNEY_PAIRING_PROOF" "$RAW"
cp "$RAW/seed.out" "$OUT/seed.txt"
# 8. Witness before the journey (private).
node "$HERE/private-psql.mjs" run "$RAW" "$HERE/witness-journey.sql" "$RAW/witness-pre.txt" > "$RAW/witness-pre.out" 2> "$RAW/witness-pre.err" || refuse RUN_E_WITNESS_PRE
# 9. The journey. Raw reporter output and test artefacts stay private; only a validated count line is staged.
set +e
(cd "$ROOT" && GB_LANE=journey npx --no-install playwright test -c playwright.gradebook-roles.config.ts --reporter=json --output="$RAW/test-results") > "$RAW/playwright.json" 2> "$RAW/playwright.err"; PW=$?
set -e
node "$HERE/run-summary.mjs" playwright "$RAW/playwright.json" "$PW" > "$RAW/playwright-summary.out" 2> "$RAW/playwright-summary.err" || refuse RUN_E_PLAYWRIGHT_SUMMARY
cp "$RAW/playwright-summary.out" "$OUT/playwright-summary.txt"
# 9b. Screenshots: only clean, allowlisted captures, re-encoded with critical PNG chunks only; validated manifest staged.
node "$HERE/shot-export.mjs" "$PARENT/shots" "$PARENT/session" "$GB_JOURNEY_PAIRING_PROOF" "$RAW/shots-export" > "$RAW/shots.out" 2> "$RAW/shots.err" || refuse RUN_E_SHOTS
node "$HERE/run-summary.mjs" shots "$RAW/shots.out" > "$RAW/shots-summary.out" 2> "$RAW/shots-summary.err" || refuse RUN_E_SHOTS_SUMMARY
mv "$RAW/shots-export" "$OUT/screenshots"
cp "$RAW/shots-summary.out" "$OUT/screenshots.txt"
# 10. Witness after (private), then the exact comparison; only its validated fixed verdict lines are staged.
node "$HERE/private-psql.mjs" run "$RAW" "$HERE/witness-journey.sql" "$RAW/witness-post.txt" > "$RAW/witness-post.out" 2> "$RAW/witness-post.err" || refuse RUN_E_WITNESS_POST
rc=0
node "$HERE/tests/compare-witness.mjs" "$RAW/witness-pre.txt" "$RAW/witness-post.txt" > "$RAW/compare.out" 2> "$RAW/compare.err" || rc=1
node "$HERE/run-summary.mjs" compare "$RAW/compare.out" > "$RAW/compare-summary.out" 2> "$RAW/compare-summary.err" || refuse RUN_E_COMPARE_SUMMARY
cp "$RAW/compare-summary.out" "$OUT/compare.txt"
[ "$PW" -eq 0 ] || rc=1
# 11. Exact evidence inventory (fixed summaries only).
[ "$(ls -A "$OUT" | LC_ALL=C sort | tr '\n' ' ')" = "compare.txt composition.txt pairing.txt playwright-summary.txt screenshots screenshots.txt seed.txt " ] || refuse RUN_E_INVENTORY
# The screenshots dir holds exactly the PNGs its validated manifest names, nothing else.
[ "$(sed -n 's/^SHOT \([^ ]*\) .*/\1.png/p' "$OUT/screenshots.txt" | LC_ALL=C sort | tr '\n' ' ')" = "$(ls -A "$OUT/screenshots" | LC_ALL=C sort | tr '\n' ' ')" ] || refuse RUN_E_INVENTORY
cat "$OUT/compare.txt" "$OUT/playwright-summary.txt"
exit $rc
