#!/usr/bin/env bash
# ABOUTME: T-09 runtime STAGE APP: runs AFTER the snapshot bootstrap. Verifies (never writes) bootstrap's vault values, application
# ABOUTME: sentinels (vault callers, fanout inventory, synthetic scratch fanout unit), the reviewed migrations, SQL tier.
# Usage: stage-app.sh <loopback db url> OLD|NEW [allow_shim]
# The guard must already be installed by stage-pre.sh. Exit 0 only if every step passes.
set -u
DB="${1:?loopback db url}"; MODE="${2:?OLD or NEW}"; ALLOW_SHIM="${3:-0}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$DB" >/dev/null || { echo "FAIL app: not a loopback DSN"; exit 2; }
case "$MODE" in OLD|NEW) ;; *) echo "FAIL app: mode must be OLD or NEW"; exit 2 ;; esac
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
run() {
  local label="$1"; shift; local out st
  out=$(psql "$DB" -v allow_shim="$ALLOW_SHIM" "$@" 2>&1); st=$?
  grep -E "egress-verify OK|^SENTINEL|ERROR|required|history|certificate" <<<"$out" | sed 's/^.*NOTICE: *//'
  [ $st -eq 0 ] || { echo "FAIL app: $label (psql exit $st)"; exit 1; }
  echo "PASS app: $label"
}
pipe() { # label, command...; streams the command's lines, fails on its status
  local label="$1"; shift
  "$@" 2>&1 | grep -v assert-local; [ "${PIPESTATUS[0]}" -eq 0 ] || { echo "FAIL app: $label"; exit 1; }
  echo "PASS app: $label"
}
# Vault is NOT written here. bootstrap.sh (localize.sql) already created each referenced name once with the loopback
# placeholder (Vault names are unique); this stage only VERIFIES that exact set and those exact values.
run "verify stage=app after bootstrap (exact vault names and values as bootstrap wrote them)"         -v stage=app -q -f "$HERE/egress-verify.sql"
run "sentinels stage=app before migrations"    -v stage=app -qAt -f "$HERE/egress-sentinels.sql"
# API tier (optional here, required by the workflow): enabled when T09_API_URL is set. Personas and the legacy API
# fixtures are created BEFORE the history window, so they are part of the protected, hashed history.
API_ON=0; [ -n "${T09_API_URL:-}" ] && API_ON=1
if [ $API_ON -eq 1 ]; then
  for v in T09_ANON_KEY_FILE T09_SERVICE_KEY_FILE T09_PERSONA_FILE; do [ -n "${!v:-}" ] || { echo "FAIL app: $v required when T09_API_URL is set"; exit 2; }; done
  # Strict parsed loopback origin (shared helper) before ANY credential-bearing request in this stage.
  node "$HERE/api-http.mjs" check "$T09_API_URL" >/dev/null 2>&1 || { echo "FAIL app: T09_API_URL refused (strict loopback origin required)"; exit 2; }
  export SUPABASE_DB_URL="$DB" T09_HISTORY_SQL="$HERE/history-hash.sql"
  pipe "personas (local GoTrue admin API, setup; tokens only in a 0600 file)" "$HERE/personas.sh" "$T09_API_URL" "$T09_ANON_KEY_FILE" "$T09_SERVICE_KEY_FILE" "$DB" "$T09_PERSONA_FILE"
  pipe "API legacy fixtures (setup, before the history window)" node "$HERE/api-controls.mjs" seed-legacy "$MODE"
fi
hist() { run "history $1" -v ON_ERROR_STOP=1 -q "${@:2}" -f "$HERE/history-hash.sql"; }
# Protected history: non-empty legacy rows are seeded BEFORE the hash window; the window is exactly the migrations, and
# no mutating control runs before the after-hash. Certificates are then re-checked after every trigger-firing step.
SEED_SUBJECTS=()
if [ $API_ON -eq 1 ]; then
  # LC and LG are seeded AS personas HC and HG, so the API controls can act as the same subjects as the protected history.
  read -r HC_ID HG_ID < <(node -e 'const o=require(process.argv[1]); console.log(o.HC.id, o.HG.id)' "$T09_PERSONA_FILE") || { echo "FAIL app: persona ids"; exit 1; }
  SEED_SUBJECTS=(-v hc="$HC_ID" -v hg="$HG_ID")
fi
hist "seed (legacy course H: genuine, legacy-invalid, historical certificate)" -v action=seed "${SEED_SUBJECTS[@]}"
hist "hash before migrations" -v action=snapshot -v label=before-migrations
pipe "reviewed migrations ($MODE), guard re-verified inside" "$HERE/apply-reviewed.sh" "$DB" "$MODE" "$ALLOW_SHIM"
hist "hash after migrations" -v action=snapshot -v label=after-migrations
hist "unchanged across the migrations" -v action=compare -v a=before-migrations -v b=after-migrations
hist "certificate baseline" -v action=certbase
run "sentinels stage=app after migrations"     -v stage=app -qAt -f "$HERE/egress-sentinels.sql"
hist "certificates intact after sentinels" -v action=certcheck
pipe "SQL tier ($MODE)" "$HERE/sql-tier.sh" "$DB" "$MODE"
hist "certificates intact after SQL tier" -v action=certcheck
hist "hash after SQL tier (rolled-back files leave history unchanged)" -v action=snapshot -v label=after-sql-tier
hist "unchanged across the SQL tier" -v action=compare -v a=after-migrations -v b=after-sql-tier
if [ $API_ON -eq 1 ]; then
  # PostgREST must see the migrated schema: reload, then a bounded readiness poll (never an unbounded wait).
  run "PostgREST schema reload requested" -v ON_ERROR_STOP=1 -qc "notify pgrst, 'reload schema'"
  # Bounded readiness poll through the same strict-origin, no-redirect client (never an unbounded wait).
  node "$HERE/api-http.mjs" ready "$T09_API_URL" "$T09_ANON_KEY_FILE" >/dev/null 2>&1 || { echo "FAIL app: REST API not ready after reload"; exit 1; }
  echo "PASS app: REST API ready after schema reload"
  pipe "API controls ($MODE; persona JWTs, witness reads, certificates re-checked after every case)" node "$HERE/api-controls.mjs" run "$MODE"
  hist "certificates intact after API controls" -v action=certcheck
fi
run "verify stage=app at teardown"             -v stage=app -q -f "$HERE/egress-verify.sql"
echo "== STAGE APP ($MODE): ALL PASS"
