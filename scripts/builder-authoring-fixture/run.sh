#!/usr/bin/env bash
# ABOUTME: Ordered runner ADAPTER for the builder-authoring acceptance lane (UNRUN source). Guards and bindings first, then D1,
# ABOUTME: served app, the qualified API/DB pairing, pairing-bound seed, witness, specs, then ALWAYS the after-witness. No SQL cleanup.
#
# Usage: scripts/builder-authoring-fixture/run.sh <evidence dir (must not exist)> [k1]
#   no second argument: the unchanged baseline run (playwright.builder-authoring.config.ts, 18 entries).
#   k1: the separate K1-only copy run (T-18): playwright.builder-authoring-k1.config.ts (BA-K1 in the three projects only),
#       launch lane builder-authoring-k1, seed.sql then seed-k1.sql (course S), witness-k1.sql (A, B and S whole rows),
#       copied-only manifest. This script alone selects it, by exporting BA_SUITE=k1 to every child; a BA_SUITE already in
#       the environment refuses, so no caller can select a suite another way.
# Env (from the shared owner's job only): SUPABASE_DB_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, E2E_BASE_URL,
#   E2E_INSTRUCTOR_PASSWORD, E2E_MEMBER_PASSWORD, STACK_OWNERSHIP_FILE, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT,
#   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH and GB_SHELL_PATH (the job's pinned headless shell). Loopback only.
# DEPENDS on the gradebook runner lane (#162 head 77beaefe) and the shared launch-binding lane; reused unchanged by path.
# Teardown: none here. The stack is disposable and the job destroys it (supabase stop --no-backup, owned network removal).
# Private parent: exactly "$RUNNER_TEMP/ba-run.XXXXXXXXXX" (mktemp, 10 chars), removed by this trap AND by the job's
#   always() step, which removes that exact name shape only. Raw streams, sessions, proof, report, shots and witness files
#   live there; the evidence dir receives only fixed-grammar summary lines and exported PNGs.
# Public values: every code this script prints is a literal here or a codes.mjs map value (child codes via
#   `summary.mjs childcode`); nothing a child printed is echoed.
# After the browser attempt nothing refuses early: summaries, shots and the after-witness are each attempted, the FIRST
#   failure is kept, and the script exits 3 with it only after the after-witness and comparison were attempted.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"; HERE="$ROOT/scripts/builder-authoring-fixture"; GBJ="$ROOT/scripts/gradebook-fixture/journey"
refuse() { echo "builder-authoring refused: $1" >&2; exit "${2:-3}"; }
OUT="${1:-}"; [ -n "$OUT" ] || refuse RUN_E_USAGE 2
[ ! -e "$OUT" ] || refuse RUN_E_OUT_EXISTS 2
[ -z "${BA_SUITE+x}" ] || refuse RUN_E_USAGE 2
case "$#:${2:-}" in
  1:) CONFIG=playwright.builder-authoring.config.ts; LANE=builder-authoring ;;
  2:k1) export BA_SUITE=k1; CONFIG=playwright.builder-authoring-k1.config.ts; LANE=builder-authoring-k1 ;;
  *) refuse RUN_E_USAGE 2 ;;
esac

# 0. Reused files must exist (the shared owner delivers them; not in this branch's base).
for f in e2e/gradebook-roles/local-binding.mjs e2e/gradebook-roles/origin-guard.mjs e2e/gradebook-roles/journey/private-dir.mjs \
         e2e/gradebook-roles/journey/pairing-proof.mjs e2e/gradebook-roles/journey/shot-core.mjs e2e/gradebook-roles/journey/observe-core.mjs \
         scripts/gradebook-fixture/journey/private-psql.mjs scripts/gradebook-fixture/journey/pairing-producer.mjs \
         scripts/gradebook-fixture/journey/shot-export.mjs scripts/e2e/assert-safe-target.mjs scripts/e2e/gb-launch-binding.ts; do
  [ -f "$ROOT/$f" ] || refuse RUN_E_DEPENDENCY
done
# 1. Pinned shared helpers, target guards, strict loopback binding, DSN shape (same order and helpers as run-journey.sh).
node "$GBJ/pairing-producer.mjs" pins "$ROOT" >/dev/null 2>&1 || refuse RUN_E_PIN
# Reused capture/export/private/observe/pairing/binding modules: exact git blob ids (codes.mjs REUSED_PINS).
(cd "$ROOT" && node --input-type=module -e '
  import fs from "node:fs"; import { createHash } from "node:crypto"; import { REUSED_PINS } from "./scripts/builder-authoring-fixture/codes.mjs";
  for (const [rel, want] of Object.entries(REUSED_PINS)) { const st = fs.lstatSync(rel); if (!st.isFile()) process.exit(1);
    const b = fs.readFileSync(rel); if (createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex") !== want) process.exit(1); }
') >/dev/null 2>&1 || refuse RUN_E_REUSED_PIN
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || refuse RUN_E_TARGET
(cd "$ROOT" && node e2e/gradebook-roles/local-binding.mjs >/dev/null 2>&1) || refuse RUN_E_BINDING
node "$GBJ/pairing-producer.mjs" dsn >/dev/null 2>&1 || refuse RUN_E_DSN
# 2. The pinned shell is exported, and the builder lane binds every config project and the setup launch to it.
[ -n "${GB_SHELL_PATH:-}" ] && [ "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" = "$GB_SHELL_PATH" ] || refuse RUN_E_SHELL
# 3. Private dirs: one fresh 0700 parent with fixed 0700 children; the trap removes exactly that parent.
TMPROOT="$(cd "${RUNNER_TEMP:-${TMPDIR:-/tmp}}" && pwd -P)"
PARENT="$(mktemp -d "$TMPROOT/ba-run.XXXXXXXXXX")" || refuse RUN_E_DIRS
cleanup() { case "$PARENT" in "$TMPROOT"/ba-run.??????????) [ -d "$PARENT" ] && [ ! -L "$PARENT" ] && rm -rf -- "$PARENT" ;; esac; }
trap cleanup EXIT
chmod 700 "$PARENT"; mkdir -m 700 "$PARENT/proof" "$PARENT/session" "$PARENT/run" "$PARENT/shots" "$PARENT/raw" "$PARENT/unused" || refuse RUN_E_DIRS
RAW="$PARENT/raw"
BA_NONCE="$(node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))')"
export BA_SESSION_DIR="$PARENT/session" BA_RUN_DIR="$PARENT/run" BA_SHOT_DIR="$PARENT/shots" BA_PAIRING_PROOF="$PARENT/proof/pairing-proof.json" BA_NONCE
(cd "$ROOT" && GB_LANE="$LANE" BA_SESSION_DIR="$PARENT/unused" BA_RUN_DIR="$PARENT/unused" npx --no-install tsx scripts/e2e/gb-launch-binding.ts) > "$RAW/launch.out" 2> "$RAW/launch.err" || refuse RUN_E_LAUNCH_BINDING
mkdir -m 700 "$OUT" || refuse RUN_E_DIRS
# child <raw name>: the child's refusal code as a codes.mjs CHILD_CODES value (NONE, UNLISTED or UNREAD otherwise).
child() {
  local v; v="$(node "$HERE/summary.mjs" childcode "$RAW/$1.out" 2>/dev/null)" || v=UNREAD
  case "$v" in NONE|UNLISTED|UNREAD) ;; *) [[ "$v" =~ ^[A-Z][A-Z0-9_]{1,63}$ ]] || v=UNREAD ;; esac
  printf '%s' "$v"
}
# step <fixed code> <raw name> <exact expected stdout line> -- command...: raw streams private, stdout must be that line.
step() {
  local code="$1" name="$2" want="$3"; shift 4
  if ! "$@" > "$RAW/$name.out" 2> "$RAW/$name.err"; then refuse "$code child=$(child "$name")"; fi
  [ "$(cat "$RAW/$name.out")" = "$want" ] || refuse "$code child=NONE"
}
# 4. D1 stack ownership and the served-app gate (the gradebook adapter's own commands, reused, not copied).
step RUN_E_D1 ownership "PASS stack ownership record verified for this run, this cluster and the pinned bootstrap (disposable is declared, not proven)" -- node "$GBJ/pairing-producer.mjs" ownership "$RAW"
step RUN_E_APP appverify "PASS served app verified by the pinned shared verifier" -- node "$GBJ/pairing-producer.mjs" appverify
# 5. API/DB pairing through the qualified producer: precheck, carrier through the DSN, DSN readback, anon API readback.
step RUN_E_PAIRING pairing "PASS pairing: carrier written through the DSN, read back through the DSN and the anon API" -- node "$GBJ/pairing-producer.mjs" pair "$PARENT/proof" "$RAW"
echo "PAIRING PASS dsn_write=1 dsn_read=match api_read=match" > "$OUT/pairing.txt"
# 6. Seed bound to that proof (seed.sql refuses unless this database holds the carrier); plain INSERTs, refuses a used stack.
step RUN_E_SEED seed "BA_SEED_OK courses=2 sections=5 lessons=5" -- node "$HERE/ba-db.mjs" seed "$BA_PAIRING_PROOF" "$BA_SESSION_DIR" "$RAW"
if [ "${BA_SUITE:-}" = k1 ]; then
  step RUN_E_SEED seed-k1 "BA_SEED_K1_OK courses=1 sections=2 lessons=3" -- node "$HERE/ba-db.mjs" seed-k1 "$BA_PAIRING_PROOF" "$BA_SESSION_DIR" "$RAW"
  cat "$RAW/seed.out" "$RAW/seed-k1.out" > "$OUT/seed.txt"
else
  cp "$RAW/seed.out" "$OUT/seed.txt"
fi
# 7. Witness before the specs (private raw lines).
node "$HERE/ba-db.mjs" witness "$RAW" "$RAW/witness-pre.txt" "$BA_NONCE" > "$RAW/witness-pre.out" 2> "$RAW/witness-pre.err" || refuse RUN_E_WITNESS_PRE
# 8. Specs, three viewports. The JSON report goes to the private run dir; stdout/stderr stay private.
set +e
(cd "$ROOT" && npx --no-install playwright test -c "$CONFIG" --output="$RAW/test-results") > "$RAW/playwright.out" 2> "$RAW/playwright.err"; PW=$?
set -e
rc=0
# From here on nothing refuses early. note() keeps the FIRST failure; every later step is still attempted, the after-witness
# and comparison always, so the pre-state witness is never removed (by the trap) before the post-state is taken.
FIRST=""
note() { [ -n "$FIRST" ] || FIRST="$1"; rc=1; }
# 9. Fixed-line summaries (exit 1 = FAIL with lines, kept; exit 2 = input refused, its one fixed line kept; noted either way).
summ() {
  local name="$1" code="$2"; shift 2; local s=0
  node "$HERE/summary.mjs" "$@" > "$OUT/$name" 2> "$RAW/$name.err" || s=$?
  if [ "$s" -ge 2 ]; then note "$code"; elif [ "$s" -eq 1 ]; then rc=1; fi
  [ -s "$OUT/$name" ] || { printf 'SUMMARY FAIL reason=no_output\n' > "$OUT/$name" || true; note "$code"; }
}
summ playwright-summary.txt RUN_E_SUMMARY_PLAYWRIGHT playwright "$BA_RUN_DIR/report.json" "$PW"
summ manifest.txt RUN_E_SUMMARY_MANIFEST manifest "$BA_RUN_DIR"
# 10. Screenshots: only clean, planned captures, critical PNG chunks only. A refusal stages one fixed line and an empty dir.
if node "$HERE/ba-shots.mjs" "$BA_SHOT_DIR" "$BA_SESSION_DIR" "$BA_PAIRING_PROOF" "$RAW/shots-export" > "$RAW/shots.out" 2> "$RAW/shots.err" \
   && mv "$RAW/shots-export" "$OUT/screenshots" && cp "$RAW/shots.out" "$OUT/screenshots.txt"; then :; else
  sc="$(child shots)"
  rm -rf -- "${OUT:?}/screenshots"; mkdir -m 700 "$OUT/screenshots" || true
  printf 'SHOTS REFUSED code=%s\n' "$sc" > "$OUT/screenshots.txt" || true
  note RUN_E_SHOTS
fi
# 11. ALWAYS: witness after (private), before any teardown, then the exact comparison.
if node "$HERE/ba-db.mjs" witness "$RAW" "$RAW/witness-post.txt" "$BA_NONCE" > "$RAW/witness-post.out" 2> "$RAW/witness-post.err"; then
  summ witness.txt RUN_E_SUMMARY_WITNESS witness "$RAW/witness-pre.txt" "$RAW/witness-post.txt"
else
  printf 'WITNESS FAIL kind=post_not_taken code=%s\nVERDICT FAIL\n' "$(child witness-post)" > "$OUT/witness.txt" || true
  note RUN_E_WITNESS_POST
fi
[ "$PW" -eq 0 ] || rc=1
# 12. Exact evidence inventory; every staged line in the shared grammar; the PNG dir equals its manifest.
[ "$(ls -A "$OUT" | LC_ALL=C sort | tr '\n' ' ')" = "manifest.txt pairing.txt playwright-summary.txt screenshots screenshots.txt seed.txt witness.txt " ] || note RUN_E_INVENTORY
node --input-type=module -e '
  import fs from "node:fs"; import { LINE } from "'"$HERE"'/summary.mjs";
  for (const f of process.argv.slice(1)) { const t = fs.readFileSync(f, "utf8"); const l = t.split("\n").slice(0, -1);
    if (!t.endsWith("\n") || l.length < 1 || l.length > 64 || Buffer.byteLength(t) > 4096 || !l.every((x) => LINE.test(x))) process.exit(1); }
' "$OUT/manifest.txt" "$OUT/pairing.txt" "$OUT/playwright-summary.txt" "$OUT/screenshots.txt" "$OUT/seed.txt" "$OUT/witness.txt" || note RUN_E_GRAMMAR
[ "$(sed -n 's/^SHOT name=\([a-z0-9_]*\) .*/\1.png/p' "$OUT/screenshots.txt" | LC_ALL=C sort | tr '\n' ' ')" = "$(ls -A "$OUT/screenshots" | LC_ALL=C sort | tr '\n' ' ')" ] || note RUN_E_INVENTORY
cat "$OUT/playwright-summary.txt" "$OUT/witness.txt" || true
[ -z "$FIRST" ] || refuse "$FIRST"
exit $rc
