#!/usr/bin/env bash
# ABOUTME: Anonymous public-catalog acceptance runner for an OWNED, disposable loopback Supabase stack (bootstrapped by the shared
# ABOUTME: local-stack lane) with the hermetic test-served app on loopback. BLOCKED today: no reviewed owned-stack proof producer.
#
# Order, each step fails closed with a fixed code and prints no raw output:
#   helper pins -> guards (targets, canonical DSN + private passfile, anon key, proof consumer) -> shared PRE contract (BLOCKED:
#   not integrated) -> diagnostic inventory ->
#   served-asset provenance -> served-app pins + hermetic verify (+ avatar-fixture verify when PUBLIC_ACCEPT_AVATAR_FIXTURE=1)
#   -> D1 ownership verify (#154 record, expected bootstrap digest, live sysid) -> pair (FIRST write: one blog_tags carrier)
#   -> proof gate (full guards) -> W0 (courses/modules empty, exactly the carrier in blog_tags) -> seed -> W1 -> browser -> W2 (must equal W1; a W2
#   failure or mismatch STOPS here, before any write probe) -> anon probe -> W3 (must equal W1).
# Output contract:
#   $PUBLIC_ACCEPT_OUT/evidence/  sanitized, allowlisted files only; the ONLY directory a runner may upload.
#   private staging               mktemp -d, mode 0700, files 0600: raw psql, Playwright and probe output. Never printed, never
#                                 uploaded, and ALWAYS removed on exit (trap), pass or fail.
# No DB cleanup exists or is allowed: no DELETE/TRUNCATE/DROP anywhere. Whole-stack disposal belongs to the runner job alone.
set -u -o pipefail
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
die() { echo "$1"; [ -n "${EV:-}" ] && [ -d "$EV" ] && echo "$1" >> "$EV/STEPS.txt"; exit "${2:-2}"; }
OUT="${PUBLIC_ACCEPT_OUT:-}"; [ -n "$OUT" ] || die PUBLIC_CATALOG_E_NO_OUT
[ -e "$OUT" ] && die PUBLIC_CATALOG_E_OUT_EXISTS
[[ "${PUBLIC_ACCEPT_RUN_ID:-}" =~ ^[0-9a-f]{32}$ ]] || die PUBLIC_CATALOG_E_RUN_ID
[ "${PUBLIC_ACCEPT_TIER:-authentic}" = authentic ] || die PUBLIC_CATALOG_E_TIER
[ -z "${PUBLIC_ACCEPT_LIST_ONLY+x}" ] || die PUBLIC_CATALOG_E_LIST_ONLY_SET
[ -z "${PUBLIC_ACCEPT_STACK_PROOF+x}" ] || die PUBLIC_CATALOG_E_PROOF_PRESET  # the proof comes only from this run's pairing step
mkdir -p "$OUT/evidence" && chmod 700 "$OUT" "$OUT/evidence" || die PUBLIC_CATALOG_E_OUT_CREATE
EV="$OUT/evidence"
PRIV="$(mktemp -d "${TMPDIR:-/tmp}/pca-private.XXXXXXXX")" || die PUBLIC_CATALOG_E_PRIVATE
chmod 700 "$PRIV"; trap 'rm -rf -- "$PRIV"' EXIT
step() { echo "== $1" >> "$EV/STEPS.txt"; echo "== $1"; }
psqlx() { env -i PATH="$PATH" PGPASSFILE="$PUBLIC_ACCEPT_DB_PASSFILE" psql -w -X -q -At -v ON_ERROR_STOP=1 "$PUBLIC_ACCEPT_DB_URL" "$@"; }
codes() { grep -oE 'PUBLIC_CATALOG_E_[A-Z_]+' "$1" | sort -u | head -20; }

step pins;      node --input-type=module -e "import('$HERE/helper-pins.mjs').then((m) => { const e = m.checkHelperPins('$ROOT'); for (const x of e) console.error(x.split(':')[0]); process.exit(e.length ? 2 : 0); })" 2> "$PRIV/pins.txt" \
                  || { codes "$PRIV/pins.txt" >> "$EV/STEPS.txt"; die PUBLIC_CATALOG_E_PINS; }
step guards;    node "$HERE/guards.mjs" --pre-pairing > "$PRIV/guards.txt" 2>&1 || { codes "$PRIV/guards.txt" | tee -a "$EV/STEPS.txt"; die PUBLIC_CATALOG_E_GUARDS; }
step pre-contract; node --input-type=module -e "import('$HERE/pre-contract.mjs').then((m) => { const e = m.checkPreContract('$ROOT'); for (const x of e) console.error(x.split(':')[0]); process.exit(e.length ? 2 : 0); })" 2> "$PRIV/pre-contract.txt" \
                  || { codes "$PRIV/pre-contract.txt" | tee -a "$EV/STEPS.txt"; die PUBLIC_CATALOG_E_PRE_CONTRACT; }
                # (once integrated: the shared stack-checks.sh net-create/net-verify/stage-pre steps run here, before W0 and the seed)
step inventory; psqlx -f "$HERE/pre-stack.sql" > "$EV/pre-stack-inventory.txt" 2>/dev/null || die PUBLIC_CATALOG_E_INVENTORY_QUERY  # diagnostic, gates nothing
step served;    node "$HERE/served-build-check.mjs" > "$PRIV/served.txt" 2>&1 || { codes "$PRIV/served.txt" | tee -a "$EV/STEPS.txt"; die PUBLIC_CATALOG_E_SERVED; }
step hermetic;  { [ -f "$ROOT/scripts/served-app/hermetic-dist.mjs" ] && [ -n "${PUBLIC_ACCEPT_PRODUCT_DIST:-}" ] && [ -n "${PUBLIC_ACCEPT_SERVED_DIR:-}" ]; } || die PUBLIC_CATALOG_E_NO_HERMETIC_CONTRACT
                node --input-type=module -e "import('$HERE/helper-pins.mjs').then((m) => { const e = m.checkHelperPins('$ROOT', m.SERVED_APP_PINS); for (const x of e) console.error(x.split(':')[0]); process.exit(e.length ? 2 : 0); })" 2> "$PRIV/served-app-pins.txt" \
                  || { codes "$PRIV/served-app-pins.txt" | tee -a "$EV/STEPS.txt"; die PUBLIC_CATALOG_E_SERVED_APP_PINS; }
                # Inputs must be fixed canonical job paths: absolute, existing directories, equal to their own physical realpath.
                # The fixture's safety claim covers that scope only (no symlink or .. aliases, no concurrent filesystem changes).
                canon() { [ -n "$1" ] && [ "${1#/}" != "$1" ] && [ -d "$1" ] && [ "$(realpath -e -- "$1" 2>/dev/null)" = "$1" ]; }
                canon "$PUBLIC_ACCEPT_PRODUCT_DIST" && canon "$PUBLIC_ACCEPT_SERVED_DIR" || die PUBLIC_CATALOG_E_NONCANONICAL_PATH
                if [ "${PUBLIC_ACCEPT_AVATAR_FIXTURE:-}" = 1 ]; then
                  canon "${PUBLIC_ACCEPT_HERMETIC_DIR:-}" || die PUBLIC_CATALOG_E_NONCANONICAL_PATH
                  # Served dir = the avatar-fixture copy; the hermetic copy it derives from is verified first, then the fixture.
                  [ -n "${PUBLIC_ACCEPT_HERMETIC_DIR:-}" ] || die PUBLIC_CATALOG_E_NO_HERMETIC_DIR
                  node "$ROOT/scripts/served-app/hermetic-dist.mjs" verify "$PUBLIC_ACCEPT_PRODUCT_DIST" "$PUBLIC_ACCEPT_HERMETIC_DIR" > "$PRIV/hermetic.txt" 2>&1 || die PUBLIC_CATALOG_E_HERMETIC_VERIFY
                  node "$ROOT/scripts/served-app/avatar-fixture.mjs" verify "$PUBLIC_ACCEPT_PRODUCT_DIST" "$PUBLIC_ACCEPT_HERMETIC_DIR" "$PUBLIC_ACCEPT_SERVED_DIR" > "$PRIV/avatar.txt" 2>&1 || die PUBLIC_CATALOG_E_AVATAR_VERIFY
                else
                  node "$ROOT/scripts/served-app/hermetic-dist.mjs" verify "$PUBLIC_ACCEPT_PRODUCT_DIST" "$PUBLIC_ACCEPT_SERVED_DIR" > "$PRIV/hermetic.txt" 2>&1 || die PUBLIC_CATALOG_E_HERMETIC_VERIFY
                fi
step ownership; SYSID="$(psqlx -c 'select system_identifier::text from pg_control_system()' 2>/dev/null)" || die PUBLIC_CATALOG_E_D1_LIVE_READ
                printf '%s' "$SYSID" | node "$HERE/d1-ownership.mjs" verify > "$PRIV/d1.txt" 2>&1 || { codes "$PRIV/d1.txt" | tee -a "$EV/STEPS.txt"; die PUBLIC_CATALOG_E_D1; }
                grep -q '^PUBLIC_CATALOG_D1_OK ' "$PRIV/d1.txt" || die PUBLIC_CATALOG_E_D1_NO_VERDICT
                unset SYSID
# FIRST WRITE. Reached only after pins, guards, the PRE contract gate (BLOCKED while its pins are empty), served + hermetic
# verify and the D1 ownership verify. One run-owned blog_tags row; no cleanup exists: stack disposal belongs to the runner.
step pair;      node "$HERE/pairing-producer.mjs" pair "$PRIV" > "$PRIV/pair.txt" 2>&1 || { codes "$PRIV/pair.txt" | tee -a "$EV/STEPS.txt"; grep -oE '^PAIR_E_[A-Z_]+$' "$PRIV/pair.txt" | head -1 >> "$EV/STEPS.txt"; die PUBLIC_CATALOG_E_PAIR; }
                grep -q '^PUBLIC_CATALOG_PAIRING_OK ' "$PRIV/pair.txt" || die PUBLIC_CATALOG_E_PAIR_NO_VERDICT
                export PUBLIC_ACCEPT_STACK_PROOF="$PRIV/stack-proof.json"
step proof;     node "$HERE/guards.mjs" > "$PRIV/guards-proof.txt" 2>&1 || { codes "$PRIV/guards-proof.txt" | tee -a "$EV/STEPS.txt"; die PUBLIC_CATALOG_E_PROOF_GATE; }
step W0;        psqlx -f "$HERE/witness.sql" > "$EV/W0.txt" 2>/dev/null || die PUBLIC_CATALOG_E_WITNESS
                grep -qx 'public.courses|0|empty' "$EV/W0.txt" && grep -qx 'public.modules|0|empty' "$EV/W0.txt" || die PUBLIC_CATALOG_E_NOT_PRISTINE
                grep -qE '^public\.blog_tags\|1\|[0-9a-f]{32}$' "$EV/W0.txt" || die PUBLIC_CATALOG_E_NOT_PRISTINE_PAIRING  # exactly the carrier row
step seed;      psqlx -f "$HERE/seed.sql" > "$PRIV/seed.txt" 2>&1 || { codes "$PRIV/seed.txt" >> "$EV/STEPS.txt"; die PUBLIC_CATALOG_E_SEED; }
step W1;        psqlx -f "$HERE/witness.sql" > "$EV/W1.txt" 2>/dev/null || die PUBLIC_CATALOG_E_WITNESS
node --input-type=module -e "import('$HERE/fixtures.mjs').then((m) => import('node:fs').then((fs) => fs.writeFileSync('$EV/MANIFEST.json', JSON.stringify({ run_id: '$PUBLIC_ACCEPT_RUN_ID', ids: m.ALL_IDS, created_by: 'seed.sql', pairing_ids: ['$(node --input-type=module -e "import('$HERE/pairing-producer.mjs').then((p) => console.log(p.PAIRING_TAG_ID))")'], pairing_created_by: 'pairing-producer.mjs' }, null, 2))))" || die PUBLIC_CATALOG_E_MANIFEST
step browser;   (cd "$ROOT" && PUBLIC_ACCEPT_REPORT="$PRIV/playwright.json" timeout 1800 npx playwright test -c playwright.public-catalog.config.ts --output="$PRIV/pw" > "$PRIV/playwright.log" 2>&1); echo $? > "$EV/playwright.exit"
                node "$HERE/pw-summary.mjs" "$PRIV/playwright.json" > "$EV/playwright-summary.txt" 2>/dev/null || echo PUBLIC_CATALOG_E_PW_REPORT >> "$EV/STEPS.txt"
step W2;        psqlx -f "$HERE/witness.sql" > "$EV/W2.txt" 2>/dev/null || die PUBLIC_CATALOG_E_W2_FAILED 1
                cmp -s "$EV/W1.txt" "$EV/W2.txt" || die PUBLIC_CATALOG_E_W2_MISMATCH 1   # stop BEFORE any write probe
step probe;     node "$HERE/anon-probe.mjs" "$PRIV/anon-probe.json" "$EV/anon-probe-summary.txt" > /dev/null 2>&1; echo $? > "$EV/anon-probe.exit"
step W3;        psqlx -f "$HERE/witness.sql" > "$EV/W3.txt" 2>/dev/null || die PUBLIC_CATALOG_E_W3_FAILED 1
rc=0
[ "$(< "$EV/playwright.exit")" = 0 ] || rc=1
[ "$(< "$EV/anon-probe.exit")" = 0 ] || rc=1   # 1 = leak or accepted write, 3 = UNVERIFIED response; both fail
cmp -s "$EV/W1.txt" "$EV/W3.txt" || { echo PUBLIC_CATALOG_E_W3_MISMATCH >> "$EV/STEPS.txt"; rc=1; }  # supporting evidence only, not RLS causality
echo "exit $rc" | tee -a "$EV/STEPS.txt"; exit $rc
