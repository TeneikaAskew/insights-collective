#!/usr/bin/env bash
# ABOUTME: Ordered runner ADAPTER for the builder-authoring acceptance lane (UNRUN source). Fixed order: target guards,
# ABOUTME: strict binding, private dirs, D1 ownership + served app (reused from the gradebook adapter), seed, specs, manifest cleanup.
#
# Usage: scripts/builder-authoring-fixture/run.sh <evidence dir (must not exist)>
# Env (from the shared owner's job only): SUPABASE_DB_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, E2E_BASE_URL,
#   E2E_INSTRUCTOR_PASSWORD, STACK_OWNERSHIP_FILE, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT. Loopback only.
# DEPENDS on the gradebook runner lane (#162 head): e2e/gradebook-roles/{local-binding,origin-guard}.mjs,
#   journey/private-dir.mjs, scripts/gradebook-fixture/journey/{private-psql,pairing-producer}.mjs. They are reused
#   unchanged and must be present; this script refuses (RUN_E_DEPENDENCY) otherwise.
# Streams: no DSN or password on a command line; raw output stays in the private parent, which the trap removes.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"; HERE="$ROOT/scripts/builder-authoring-fixture"; GBJ="$ROOT/scripts/gradebook-fixture/journey"
refuse() { echo "builder-authoring refused: $1" >&2; exit "${2:-3}"; }
OUT="${1:-}"; [ -n "$OUT" ] || refuse RUN_E_USAGE 2
[ ! -e "$OUT" ] || refuse RUN_E_OUT_EXISTS 2
for f in e2e/gradebook-roles/local-binding.mjs e2e/gradebook-roles/origin-guard.mjs e2e/gradebook-roles/journey/private-dir.mjs \
         scripts/gradebook-fixture/journey/private-psql.mjs scripts/gradebook-fixture/journey/pairing-producer.mjs; do
  [ -f "$ROOT/$f" ] || refuse RUN_E_DEPENDENCY
done
# 1. Pins, target guards, strict loopback binding and DSN presence (same order and helpers as run-journey.sh).
node "$GBJ/pairing-producer.mjs" pins "$ROOT" >/dev/null 2>&1 || refuse RUN_E_PIN
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || refuse RUN_E_TARGET
(cd "$ROOT" && node e2e/gradebook-roles/local-binding.mjs >/dev/null 2>&1) || refuse RUN_E_BINDING
node "$GBJ/pairing-producer.mjs" dsn >/dev/null 2>&1 || refuse RUN_E_DSN
# 2. Private dirs: one fresh 0700 parent; the trap removes exactly that parent.
TMPROOT="$(cd "${RUNNER_TEMP:-${TMPDIR:-/tmp}}" && pwd -P)"
PARENT="$(mktemp -d "$TMPROOT/ba-run.XXXXXXXXXX")" || refuse RUN_E_DIRS
cleanup() { case "$PARENT" in "$TMPROOT"/ba-run.??????????) [ -d "$PARENT" ] && [ ! -L "$PARENT" ] && rm -rf -- "$PARENT" ;; esac; }
trap cleanup EXIT
chmod 700 "$PARENT"; mkdir -m 700 "$PARENT/session" "$PARENT/run" "$PARENT/raw" || refuse RUN_E_DIRS
RAW="$PARENT/raw"
export BA_SESSION_DIR="$PARENT/session" BA_RUN_DIR="$PARENT/run"
BA_NONCE="$(node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))')"; export BA_NONCE
mkdir -m 700 "$OUT" || refuse RUN_E_DIRS
# 3. D1 stack ownership and the served-app gate, through the gradebook adapter's own commands (reused, not copied).
node "$GBJ/pairing-producer.mjs" ownership "$RAW" > "$RAW/ownership.out" 2> "$RAW/ownership.err" || refuse RUN_E_D1
node "$GBJ/pairing-producer.mjs" appverify > "$RAW/appverify.out" 2> "$RAW/appverify.err" || refuse RUN_E_APP
# 4. Seed (plain INSERTs; refuses if any fixture id exists).
node "$GBJ/private-psql.mjs" run "$RAW" "$HERE/seed.sql" "$RAW/seed.raw" > "$RAW/seed.out" 2> "$RAW/seed.err" || refuse RUN_E_SEED
echo "PASS builder-authoring seed: 2 draft courses, 5 sections, 5 lessons; nothing else" > "$OUT/seed.txt"
# 5. Specs (three viewports). Raw report stays private; only a count line is staged.
set +e
(cd "$ROOT" && npx --no-install playwright test -c playwright.builder-authoring.config.ts --output="$RAW/test-results") > "$RAW/playwright.out" 2> "$RAW/playwright.err"; PW=$?
set -e
node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const s = r.stats || {};
  console.log(`PLAYWRIGHT expected=${s.expected ?? 0} unexpected=${s.unexpected ?? 0} skipped=${s.skipped ?? 0} flaky=${s.flaky ?? 0} exit=${process.argv[2]}`);
' "$BA_RUN_DIR/report.json" "$PW" > "$OUT/playwright-summary.txt" || refuse RUN_E_SUMMARY
# 6. Manifest cleanup: exactly the seeded ids plus the wizard-created ids this run recorded, ownership proven first.
node --input-type=module -e '
  import fs from "node:fs"; import path from "node:path";
  import { buildManifest, cleanupSql } from "'"$HERE"'/manifest.mjs";
  const dir = process.env.BA_RUN_DIR;
  const ids = fs.readdirSync(dir).filter((f) => /^created-ba-(1440|768|390)\.txt$/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), "utf8").trim());
  fs.writeFileSync(path.join(process.argv[1], "cleanup.sql"), cleanupSql(buildManifest({ nonce: process.env.BA_NONCE, createdCourseIds: ids })), { mode: 0o600 });
  console.log(`MANIFEST created=${ids.length}`);
' "$RAW" > "$OUT/manifest.txt" || refuse RUN_E_MANIFEST
node "$GBJ/private-psql.mjs" run "$RAW" "$RAW/cleanup.sql" "$RAW/cleanup.raw" > "$RAW/cleanup.out" 2> "$RAW/cleanup.err" || refuse RUN_E_CLEANUP
echo "PASS builder-authoring cleanup: manifest rows only" > "$OUT/cleanup.txt"
[ "$(ls -A "$OUT" | LC_ALL=C sort | tr '\n' ' ')" = "cleanup.txt manifest.txt playwright-summary.txt seed.txt " ] || refuse RUN_E_INVENTORY
cat "$OUT/playwright-summary.txt"
[ "$PW" -eq 0 ]
